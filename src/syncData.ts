import _debug from 'debug'
import type { Redis } from 'ioredis'
import _ from 'lodash/fp.js'
import mongoChangeStream, {
  type ChangeStreamOptions,
  type ScanOptions,
} from 'mongochangestream'
import type {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
  Document,
} from 'mongodb'
import { mapLeaves } from 'obj-walker'
import type { QueueOptions } from 'prom-utils'

import { convertSchema } from './convertSchema.js'
import type { Crate, ErrorResult, QueryResult } from './crate.js'
import type {
  ConvertOptions,
  Events,
  ImmutableOption,
  SyncOptions,
} from './types.js'
import {
  getFailedRecords,
  renameKeys,
  setDefaults,
  sumByRowcount,
} from './util.js'

const debug = _debug('mongo2crate:sync')

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

  const handleResult = (
    result: QueryResult | ErrorResult,
    operationType: ChangeStreamDocument['operationType'],
    doc: Document
  ) => {
    debug('Change stream result %O', result)
    if ('rowcount' in result) {
      emit('process', {
        success: result.rowcount,
        changeStream: true,
        operationCounts: { [operationType]: 1 },
      })
    } else {
      emit('error', { error: result, changeStream: true, failedDoc: doc })
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
        handleResult(result, doc.operationType, document)
      } else if (doc.operationType === 'update') {
        const document = doc.fullDocument ? mapper(doc.fullDocument) : {}
        const { updatedFields, removedFields } = doc.updateDescription
        const removed = removedFields && setDefaults(removedFields, null)
        const update = mapper({ ...updatedFields, ...removed })
        if (_.size(update)) {
          const result = await crate.upsert(qualifiedName, document, update)
          handleResult(result, doc.operationType, document)
        }
      } else if (doc.operationType === 'replace') {
        const id = doc.documentKey._id.toString()
        // Delete
        await crate.deleteById(qualifiedName, id)
        // Insert
        const document = mapper(doc.fullDocument)
        const result = await crate.insert(qualifiedName, document)
        handleResult(result, doc.operationType, document)
      } else if (doc.operationType === 'delete') {
        const id = doc.documentKey._id.toString()
        const result = await crate.deleteById(qualifiedName, id)
        handleResult(result, doc.operationType, { id })
      }
    } catch (e) {
      emit('error', { error: e, changeStream: true })
    }
  }
  /**
   * Process insert documents in bulk.
   */
  const processInsertRecords = async (
    docs: ChangeStreamInsertDocument[],
    type = 'initialScan'
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
        const failedDocs = getFailedRecords(result.results, documents)
        emit('process', {
          success: numInserted,
          fail: numFailed,
          ...(failedDocs.length && { failedDocs }),
          [type]: true,
          operationCounts: { insert: docs.length },
        })
      }
      if ('error' in result) {
        emit('error', { error: result, [type]: true })
      }
    } catch (e) {
      emit('error', { error: e, [type]: true })
    }
  }

  const processChangeStream = (
    options?: QueueOptions & ChangeStreamOptions & ImmutableOption
  ) =>
    options?.immutable
      ? // The collection is immutable and therefore only inserts will occur
        sync.processChangeStream(
          (docs) =>
            processInsertRecords(
              // Typscript hack
              docs as unknown as ChangeStreamInsertDocument[],
              'changeStream'
            ),
          // Ensure we only receive insert events
          { ...options, operationTypes: ['insert'] }
        )
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
