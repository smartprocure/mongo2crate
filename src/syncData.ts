import _debug from 'debug'
import type { Redis } from 'ioredis'
import _ from 'lodash/fp.js'
import { type ChangeStreamOptions, type ScanOptions } from 'mongochangestream'
import * as mongoChangeStream from 'mongochangestream'
import { renameKeys } from 'mongochangestream'
import type {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
  Document,
} from 'mongodb'
import { mapLeaves } from 'obj-walker'
import type { QueueOptions } from 'prom-utils'

import { convertSchema } from './convertSchema.js'
import type { Crate, Response } from './crate.js'
import type {
  ChangeStreamProcessEvent,
  ConvertOptions,
  ErrorLike,
  Events,
  OptimizationOptions,
  ProcessEvent,
  SyncOptions,
} from './types.js'
import {
  getFailedRecords,
  partitionEvents,
  setDefaults,
  sumByRowcount,
} from './util.js'

const debug = _debug('mongo2crate:sync')

const maybeThrow = (error: ErrorLike) => {
  // This exception can be thrown if a document is updated and handled
  // by processChangeStream before runInitialScan has processed the record.
  //
  // DuplicateKeyException[A document with the same primary key exists already]
  if (!error?.message?.includes('DuplicateKeyException')) {
    throw error
  }
}

export const initSync = (
  redis: Redis,
  collection: Collection,
  crate: Crate,
  options: SyncOptions & mongoChangeStream.SyncOptions = {}
) => {
  const mapper = (doc: Document) => {
    if (options.mapper) {
      mapLeaves(doc, options.mapper, { modifyInPlace: true })
    }
    renameKeys(doc, { ...options.rename, _id: 'id' })
    debug('Mapped doc %o', doc)
    return doc
  }
  const schemaName = options.schemaName || 'doc'
  const tableName = options.tableName || collection.collectionName.toLowerCase()
  const qualifiedName = `"${schemaName}"."${tableName}"`
  // Initialize sync
  const sync = mongoChangeStream.initSync<Events>(redis, collection, options)
  // Use emitter from mongochangestream
  const emitter = sync.emitter
  const emit = (event: Events, data: object) => {
    emitter.emit(event, { type: event, ...data })
  }

  const createTableFromSchema = async (
    jsonSchema: object,
    options: ConvertOptions = {}
  ) => {
    const createTableStmt = convertSchema(jsonSchema, qualifiedName, {
      omit: options.omit,
      ...options,
    })
    return crate.query(createTableStmt)
  }

  const handleChangeStreamResult = (
    result: Response,
    operationType: ChangeStreamDocument['operationType']
  ) => {
    debug('Change stream result %O', result)
    if ('rowcount' in result) {
      const event = {
        success: result.rowcount,
        fail: 0,
        changeStream: true,
        operationCounts: { [operationType]: 1 },
      } as ChangeStreamProcessEvent
      emit('process', event)
    } else {
      maybeThrow(result.error)
    }
  }
  /**
   * Process change stream events.
   */
  const processChangeStreamRecords = async (docs: ChangeStreamDocument[]) => {
    // Assume batchSize is always 1
    const doc = docs[0]
    try {
      if (doc.operationType === 'insert') {
        const document = mapper(doc.fullDocument)
        const result = await crate.insert(qualifiedName, document)
        handleChangeStreamResult(result, doc.operationType)
      } else if (doc.operationType === 'update') {
        const document = doc.fullDocument ? mapper(doc.fullDocument) : {}
        const { updatedFields, removedFields } = doc.updateDescription
        const removed = removedFields && setDefaults(removedFields, null)
        const update = mapper({ ...updatedFields, ...removed })
        if (_.size(update)) {
          const result = await crate.upsert(qualifiedName, document, update)
          handleChangeStreamResult(result, doc.operationType)
        }
      } else if (doc.operationType === 'replace') {
        const _id = doc.documentKey._id
        // Delete
        await crate.deleteById(qualifiedName, _id.toString())
        // Insert
        const document = mapper(doc.fullDocument)
        const result = await crate.insert(qualifiedName, document)
        handleChangeStreamResult(result, doc.operationType)
      } else if (doc.operationType === 'delete') {
        const _id = doc.documentKey._id
        const result = await crate.deleteById(qualifiedName, _id.toString())
        handleChangeStreamResult(result, doc.operationType)
      }
    } catch (e) {
      maybeThrow(e as Error)
    }
  }
  /**
   * Process insert documents in bulk.
   */
  const processInsertRecords = async (
    docs: ChangeStreamInsertDocument[],
    type: 'initialScan' | 'changeStream' = 'initialScan'
  ) => {
    try {
      const documents = docs.map(({ fullDocument }) => mapper(fullDocument))
      const result = await crate.bulkInsert(qualifiedName, documents)
      debug('Bulk insert result %O', result)
      if ('results' in result) {
        // 1 indicates success
        const numInserted = sumByRowcount(1)(result.results)
        // -2 indicates failure
        const numFailed = sumByRowcount(-2)(result.results)
        const failedDocs = getFailedRecords(result.results, docs)
        const event = {
          success: numInserted,
          fail: numFailed,
          ...(failedDocs.length && { failedDocs }),
          [type]: true,
          operationCounts: { insert: docs.length },
        } as ProcessEvent
        emit('process', event)
      }
      if ('error' in result) {
        maybeThrow(result.error)
      }
    } catch (e) {
      maybeThrow(e as Error)
    }
  }

  const processChangeStream = (
    options?: QueueOptions & ChangeStreamOptions & OptimizationOptions
  ) =>
    options?.autoOptimizeInserts
      ? sync.processChangeStream(async (docs) => {
          const partitions = partitionEvents(docs)
          for (const partition of partitions) {
            // We have more than one event so this is a grouped set of inserts
            if (partition.length > 1) {
              debug('Change stream insert batch of length %d', partition.length)
              await processInsertRecords(
                // We know these are going to be insert events
                partition as unknown as ChangeStreamInsertDocument[],
                'changeStream'
              )
            } else {
              await processChangeStreamRecords(partition)
            }
          }
        }, options)
      : sync.processChangeStream(processChangeStreamRecords, {
          ...options,
          // We can only handle one record at a time
          batchSize: 1,
        })

  const runInitialScan = (options?: QueueOptions & ScanOptions) =>
    sync.runInitialScan(processInsertRecords, options)

  return {
    ...sync,
    /**
     * Process MongoDB change stream for the given collection.
     */
    processChangeStream,
    /**
     * Run initial collection scan. `options.batchSize` defaults to 500.
     * Sorting defaults to `_id`.
     */
    runInitialScan,
    /**
     * Convert the given JSON schema to CrateDB table DDL.
     */
    createTableFromSchema,
    schemaName,
    tableName,
    qualifiedName,
    emitter,
  }
}
