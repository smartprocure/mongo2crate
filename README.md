# Mongo2Crate

Mongo2Crate is a utility that seamlessly synchronizes data from MongoDB to CrateDB. If you're looking to leverage the scalability and real-time analytics capabilities of CrateDB with data from MongoDB, this tool is indispensable. This guide provides a comprehensive introduction to set up synchronization and convert MongoDB JSON schemas to CrateDB DDL.

## Table of Contents
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Sync MongoDB to CrateDB](#sync-mongodb-to-cratedb)
- [Convert MongoDB JSON Schema to CrateDB DDL](#convert-mongodb-json-schema-to-cratedb-ddl)
- [Conclusion](#conclusion)

## Getting Started

### Prerequisites
- An active MongoDB instance.
- An active CrateDB instance.
- A Redis instance (used for synchronization state).
- Node.js environment.

### Installation
```bash
npm install mongo2crate
```

## Sync MongoDB to CrateDB

Set up the synchronization between MongoDB and CrateDB with the following steps:

```typescript
import { initSync, crate } from 'mongo2crate'
import { default as Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import retry from 'p-retry'
import _ from 'lodash/fp.js'

const client = await MongoClient.connect()
const db = client.db()

const sync = initSync(
    new Redis({ keyPrefix: 'cratedb:' }),
    db.collection('myCollection'),
    crate(),
    { omit: ['password', 'unneededStuff'] }
)

// Log events
sync.emitter.on('process', console.info)
sync.emitter.on('error', console.error)
sync.emitter.on('cursorError', () => process.exit(1))

// Create SQL table from JSON schema
const schema = await sync.getCollectionSchema(db)
if (schema) {
    await sync.createTableFromSchema(schema)
}

// Process change stream events
const changeStream = await sync.processChangeStream()
changeStream.start()

// Detect schema changes and stop change stream if detected
const schemaChange = await sync.detectSchemaChange(db)
schemaChange.start()
sync.emitter.on('schemaChange', changeStream.stop)

// Run initial scan of collection
const options = { batchSize: 1000 }
const initialScan = await sync.runInitialScan(options)
initialScan.start()
```

## Convert MongoDB JSON Schema to CrateDB DDL

This section guides you through the process of translating MongoDB's JSON schemas into CrateDB's table definitions.

```typescript
import { convertSchema } from 'mongo2crate'
const schema = {
    bsonType: 'object',
    additionalProperties: false,
    required: ['name', 'type'],
    properties: {
        _id: {
            bsonType: 'objectId',
        },
        name: { bsonType: ['string', 'null'] },
        numberOfEmployees: {
            bsonType: 'string',
            enum: [
                '1 - 5',
                '6 - 20',
                '21 - 50',
                '51 - 200',
                '201 - 500',
                '500+',
            ],
        },
        notificationPreferences: {
            bsonType: 'array',
            items: {
                bsonType: 'string',
                enum: [
                    'newMatchingRFQ',
                    'activityOnRFQWhereParticipant',
                    'activityOnRFQBySameOrgUsers',
                ],
            },
        },
        addresses: {
            bsonType: 'array',
            items: {
                bsonType: 'object',
                additionalProperties: false,
                properties: {
                    address: {
                        bsonType: 'object',
                        additionalProperties: false,
                        properties: {
                            street: { bsonType: 'string' },
                            city: { bsonType: 'string' },
                            county: { bsonType: 'string' },
                            state: { bsonType: 'string' },
                            zip: { bsonType: 'string' },
                            country: { bsonType: 'string' },
                            latitude: { bsonType: 'number' },
                            longitude: { bsonType: 'number' },
                        },
                    },
                    name: { bsonType: 'string' },
                    isPrimary: { bsonType: 'bool' },
                },
            },
        },
        integrations: {
            bsonType: 'object',
            additionalProperties: true,
            properties: {
                stripe: {
                    bsonType: 'object',
                    additionalProperties: true,
                    properties: {
                        priceId: {
                            bsonType: 'number',
                        },
                        subscriptionStatus: {
                            bsonType: 'string',
                        },
                    },
                },
            },
        },
        metadata: {
            bsonType: 'object',
        },
    },
}

const ddl = convertSchema(schema, '"doc"."foobar"', {
    overrides: [
        { path: 'addresses.address.l*', bsonType: 'double' },
        {
            path: 'description',
            flags: ['notNull', 'indexOff', 'columnStoreOff'],
        },
    ],
})

console.log(ddl);
```

When you execute the above, it provides a CrateDB table creation statement. This ensures a smooth transition of your MongoDB collections into CrateDB tables.

## Conclusion

Mongo2Crate bridges the gap between MongoDB and CrateDB effortlessly. Whether you're migrating data, setting up real-time analytics, or merely exploring both databases, this tool eliminates the need for manual effort and guarantees data consistency. Dive into the world of seamless synchronization with Mongo2Crate!