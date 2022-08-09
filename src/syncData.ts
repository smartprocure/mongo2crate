import {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
} from 'mongodb'
import { default as Redis } from 'ioredis'
import mongoChangeStream from 'mongochangestream'
import { stats } from 'print-stats'
import _ from 'lodash/fp.js'
import { QueueOptions } from 'prom-utils'
import { Crate } from './crate.js'

const renameKey = (obj: Record<string, any>, key: string, newKey: string) => {
  obj[newKey] = obj[key]
  delete obj[key]
}

export const initSync = (
  redis: Redis,
  crate: Crate,
  collection: Collection
) => {
  const dbStats = stats()
  const tableName = collection.collectionName
  const processRecord = async (doc: ChangeStreamDocument) => {
    console.info(JSON.stringify(doc, null, 2))
    try {
      if (doc.operationType === 'insert') {
        const document = doc.fullDocument
        renameKey(document, '_id', 'id')
        await crate.insert(tableName, document)
      } else if (doc.operationType === 'update') {
        const document = doc.fullDocument || {}
        renameKey(document, '_id', 'id')
        const { updatedFields, removedFields } = doc.updateDescription
        const removed =
          removedFields &&
          _.zipObject(removedFields, _.repeat(removedFields.length, 'NULL'))
        const update = { ...updatedFields, ...removed }
        crate.upsert(tableName, document, update)
      } else if (doc.operationType === 'delete') {
        await crate.deleteById(tableName, doc.documentKey._id.toString())
      }
      dbStats.incRows()
    } catch (e) {
      console.error('ERROR', e)
      dbStats.incErrors()
    }
    dbStats.print()
  }

  const processRecords = async (docs: ChangeStreamInsertDocument[]) => {
    // console.info(JSON.stringify(docs, null, 2))
    try {
      const response = await elastic.bulk({
        operations: docs.flatMap((doc) => [
          { create: { _index: index, _id: doc.fullDocument._id } },
          _.omit(['_id'], doc.fullDocument),
        ]),
      })
      // console.dir(response, { depth: 10 })
      if (response.errors) {
        const errors = response.items.filter((doc) => doc.create?.error)
        const numErrors = errors.length
        console.error('ERRORS %d', numErrors)
        console.dir(errors, { depth: 10 })
        dbStats.incErrors(numErrors)
        dbStats.incRows(docs.length - numErrors)
      } else {
        dbStats.incRows(docs.length)
      }
    } catch (e) {
      console.error('ERROR', e)
      dbStats.incErrors()
    }
    dbStats.print()
  }

  const sync = mongoChangeStream.initSync(redis)
  const processChangeStream = () =>
    sync.processChangeStream(collection, processRecord)
  const runInitialScan = (options?: QueueOptions) =>
    sync.runInitialScan(collection, processRecords, options)

  return { processChangeStream, runInitialScan }
}
