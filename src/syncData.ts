import type {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
} from 'mongodb'
import type { Redis } from 'ioredis'
import mongoChangeStream, { ScanOptions, ChangeStreamOptions } from 'mongochangestream'
import _ from 'lodash/fp.js'
import { QueueOptions } from 'prom-utils'
import { Crate, ErrorResult, QueryResult } from './crate.js'
import { renameId, setDefaults, sumByRowcount } from './util.js'
import { ConvertOptions, SyncOptions, Events } from './types.js'
import { convertSchema } from './convertSchema.js'
import _debug from 'debug'

const debug = _debug('mongo2crate:sync')

export const initSync = (
  redis: Redis,
  collection: Collection,
  crate: Crate,
  options: SyncOptions & mongoChangeStream.SyncOptions = {}
) => {
  const mapper = options.mapper || renameId
  const schemaName = options.schemaName || 'doc'
  const tableName = options.tableName || collection.collectionName.toLowerCase()
  const qualifiedName = `"${schemaName}"."${tableName}"`
  // Initialize sync
  const sync = mongoChangeStream.initSync(redis, collection, options)
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

  const handleResult = (result: QueryResult | ErrorResult) => {
    debug('Result %O', result)
    if ('rowcount' in result) {
      emit('process', { success: result.rowcount })
    } else {
      emit('error', { error: result })
    }
  }
  /**
   * Process a change stream event.
   */
  const processRecord = async (doc: ChangeStreamDocument) => {
    try {
      if (doc.operationType === 'insert') {
        const document = mapper(doc.fullDocument)
        const result = await crate.insert(qualifiedName, document)
        handleResult(result)
      } else if (doc.operationType === 'update') {
        const document = doc.fullDocument ? mapper(doc.fullDocument) : {}
        const { updatedFields, removedFields } = doc.updateDescription
        const removed = removedFields && setDefaults(removedFields, null)
        const update = mapper({ ...updatedFields, ...removed })
        if (_.size(update)) {
          const result = await crate.upsert(qualifiedName, document, update)
          handleResult(result)
        }
      } else if (doc.operationType === 'replace') {
        const id = doc.documentKey._id.toString()
        // Delete
        await crate.deleteById(qualifiedName, id)
        // Insert
        const document = mapper(doc.fullDocument)
        const result = await crate.insert(qualifiedName, document)
        handleResult(result)
      } else if (doc.operationType === 'delete') {
        const id = doc.documentKey._id.toString()
        const result = await crate.deleteById(qualifiedName, id)
        handleResult(result)
      }
    } catch (e) {
      emit('error', { error: e })
    }
  }
  /**
   * Process scan documents.
   */
  const processRecords = async (docs: ChangeStreamInsertDocument[]) => {
    try {
      const documents = docs.map(({ fullDocument }) => mapper(fullDocument))
      const result = await crate.bulkInsert(qualifiedName, documents)
      debug('Result %O', result)
      if ('results' in result) {
        const numInserted = sumByRowcount(1)(result.results)
        const numFailed = sumByRowcount(-2)(result.results)
        emit('process', { success: numInserted, fail: numFailed })
      }
    } catch (e) {
      emit('error', { error: e })
    }
  }

  const processChangeStream = (options?: ChangeStreamOptions) =>
    sync.processChangeStream(processRecord, options)
  const runInitialScan = (options?: QueueOptions & ScanOptions) =>
    sync.runInitialScan(processRecords, options)

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
