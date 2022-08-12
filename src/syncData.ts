import {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
} from 'mongodb'
import { default as Redis } from 'ioredis'
import mongoChangeStream, { ScanOptions } from 'mongochangestream'
import { stats } from 'print-stats'
import _ from 'lodash/fp.js'
import { QueueOptions } from 'prom-utils'
import { Crate, ErrorResult, QueryResult } from './crate.js'
import { defaultDocMapper, setDefaults, sumByRowcount } from './util.js'

export const initSync = (
  redis: Redis,
  crate: Crate,
  collection: Collection,
  docMapper = defaultDocMapper
) => {
  const dbStats = stats(collection.collectionName)
  const tableName = collection.collectionName.toLowerCase()
  const handleResult = (result: QueryResult | ErrorResult) => {
    if ('rowcount' in result) {
      dbStats.incRows(result.rowcount)
    } else {
      console.error('ERROR %O', result)
      dbStats.incErrors()
    }
  }
  const processRecord = async (doc: ChangeStreamDocument) => {
    try {
      if (doc.operationType === 'insert') {
        const document = docMapper(doc.fullDocument)
        const result = await crate.insert(tableName, document)
        handleResult(result)
      } else if (doc.operationType === 'update') {
        const document = doc.fullDocument ? docMapper(doc.fullDocument) : {}
        const { updatedFields, removedFields } = doc.updateDescription
        const removed = removedFields && setDefaults(removedFields, null)
        const update = docMapper({ ...updatedFields, ...removed })
        if (_.size(update)) {
          const result = await crate.upsert(tableName, document, update)
          handleResult(result)
        }
      } else if (doc.operationType === 'delete') {
        const id = doc.documentKey._id.toString()
        const result = await crate.deleteById(tableName, id)
        handleResult(result)
      }
    } catch (e) {
      console.error('ERROR', e)
    }
    dbStats.print()
  }

  const processRecords = async (docs: ChangeStreamInsertDocument[]) => {
    try {
      const documents = docs.map(({ fullDocument }) => docMapper(fullDocument))
      const result = await crate.bulkInsert(tableName, documents)
      if ('results' in result) {
        const numInserted = sumByRowcount(1)(result.results)
        const numFailed = sumByRowcount(-2)(result.results)
        dbStats.incRows(numInserted)
        dbStats.incErrors(numFailed)
      } else {
        dbStats.incErrors()
      }
    } catch (e) {
      console.error('ERROR', e)
    }
    dbStats.print()
  }

  const sync = mongoChangeStream.initSync(redis)
  const processChangeStream = () =>
    sync.processChangeStream(collection, processRecord)
  const runInitialScan = (options?: QueueOptions & ScanOptions) =>
    sync.runInitialScan(collection, processRecords, options)
  const keys = mongoChangeStream.getKeys(collection)

  return { processChangeStream, runInitialScan, keys }
}
