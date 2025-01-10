import Redis from 'ioredis'
import _ from 'lodash/fp.js'
import {
  initState as initRedisAndMongoState,
  numDocs,
} from 'mongochangestream-testing'
import { type Db, MongoClient } from 'mongodb'
import ms from 'ms'
import { setTimeout } from 'node:timers/promises'
import { assert, describe, expect, test } from 'vitest'

import * as mongo2crate from './index.js'
import { type SyncOptions } from './index.js'

const getConns = _.memoize(async () => {
  // Redis
  const redis = new Redis({ keyPrefix: 'testing:' })
  // MongoDB
  const mongoClient = await MongoClient.connect(
    process.env.MONGO_CONN as string
  )
  const db = mongoClient.db()
  const coll = db.collection('testing')
  // Elastic
  const crate = mongo2crate.crate({
    sqlEndpoint: process.env.SQL_ENDPOINT as string,
    auth: process.env.AUTH as string,
  })
  return { mongoClient, crate, db, coll, redis }
})

const getSync = async (options?: SyncOptions) => {
  const { redis, coll, crate } = await getConns()
  const sync = mongo2crate.initSync(redis, coll, crate, {
    ...options,
    schemaName: 'mongo2crate_testing',
  })
  sync.emitter.on('stateChange', console.log)
  return sync
}

const initCrateState = async (
  sync: Awaited<ReturnType<typeof getSync>>,
  db: Db
) => {
  const { crate } = await getConns()
  // Drop table
  await crate.query(`DROP TABLE IF EXISTS ${sync.qualifiedName}`)
  console.log('Dropped table - %s', sync.qualifiedName)
  // Schema
  const schema = await sync.getCollectionSchema(db)
  if (schema) {
    const result = await sync.createTableFromSchema(schema)
    if ('error' in result) {
      console.error(result.error)
      process.exit(1)
    }
    console.log('Created table from schema')
  } else {
    console.error('Missing schema')
    process.exit(1)
  }
}

describe.sequential('syncCollection', () => {
  test('initialScan should work', async () => {
    const { coll, db, crate } = await getConns()
    const sync = await getSync()
    await initRedisAndMongoState(sync, db, coll)
    await initCrateState(sync, db)

    const initialScan = await sync.runInitialScan()
    // Wait for initial scan to complete
    await initialScan.start()
    await setTimeout(ms('1s'))
    // Stop
    await initialScan.stop()
    const countResponse = await crate.query(
      `SELECT COUNT(*) FROM ${sync.qualifiedName}`
    )
    if (!('error' in countResponse)) {
      expect(countResponse.rows[0][0]).toBe(numDocs)
      return
    }
    assert.fail(countResponse.error.message)
  })
  test('should process records via change stream', async () => {
    const { coll, db, crate } = await getConns()
    const sync = await getSync()
    const numDocs = 100
    await initRedisAndMongoState(sync, db, coll, numDocs)
    await initCrateState(sync, db)

    const changeStream = await sync.processChangeStream()
    changeStream.start()
    await setTimeout(ms('1s'))
    const date = new Date()
    // Update records
    coll.updateMany({}, { $set: { createdAt: date } })
    // Wait for the change stream events to be processed
    await setTimeout(ms('8s'))
    const countResponse = await crate.query(
      `SELECT COUNT(*) FROM ${sync.qualifiedName} WHERE "createdAt" >= '${date.toISOString()}'`
    )
    // Stop
    await changeStream.stop()
    if (!('error' in countResponse)) {
      expect(countResponse.rows[0][0]).toBe(numDocs)
      return
    }
    assert.fail(countResponse.error.message)
  })
})
