# Mongo to Crate

## Sync MongoDB to Crate

```typescript
import { default as Redis } from 'ioredis'
import _ from 'lodash/fp.js'
import { crate, initSync } from 'mongo2crate'
import { MongoClient } from 'mongodb'
import retry from 'p-retry'

const client = await MongoClient.connect()
const db = client.db()

/**
 * Use `mapper` to limit the length of strings since there is a 32k
 * character limit for text fields with the default columnar index.
 */
const mapper = (node: Node) => {
  if (typeof node.val === 'string') {
    return node.val.slice(0, 250)
  }
  return node.val
}

const sync = initSync(
    new Redis({ keyPrefix: 'cratedb:' }),
    db.collection('myCollection'),
    crate(),
    { omit: ['password', 'unneededStuff'], mapper }
)
// Log events
sync.emitter.on('process', console.info)
sync.emitter.on('error', console.error)
sync.emitter.on('cursorError', () => process.exit(1))
// Create SQL table from JSON schema
const schema = await sync.getCollectionSchema(db)
if (schema) {
    // The table name is derieved from the collection name and uses
    // the doc schema by default. These can be overriden in the options.
    await sync.createTableFromSchema(schema)
}
// Process change stream events
const changeStream = await sync.processChangeStream()
changeStream.start()
// Detect schema changes and stop change stream if detected
const schemaChange = await sync.detectSchemaChange(db)
schemaChange.start()
sync.emitter.on('schemaChange', changeStream.stop)
// Run initial scan of collection batching documents by 1000
const options = { batchSize: 1000 }
const initialScan = await sync.runInitialScan(options)
initialScan.start()
```

## Convert a JSON schema to Crate DDL

The low-level function for converting a JSON schema to a table definition
is `convertSchema`. You can also use the `createTableFromSchema` method
on `initSync` to generate the table definition and write it to CrateDB.

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

convertSchema(schema, '"doc"."foobar"', {
    strictMode: true,
    overrides: [
        // Glob expression
        { path: 'addresses.address.l*', bsonType: 'double' },
        {
            path: 'description',
            flags: ['notNull', 'indexOff', 'columnStoreOff'],
        },
    ],
})
```

Output:

```
CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT NOT NULL INDEX OFF STORAGE WITH (columnstore = false),
  "numberOfEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(STRICT) AS (
      "address" OBJECT(STRICT) AS (
        "street" TEXT,
        "city" TEXT,
        "county" TEXT,
        "state" TEXT,
        "zip" TEXT,
        "country" TEXT,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION
      ),
      "name" TEXT,
      "isPrimary" BOOLEAN
    )
  ),
  "integrations" OBJECT(DYNAMIC) AS (
    "stripe" OBJECT(DYNAMIC) AS (
      "priceId" INTEGER,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
)
```

## Run the test locally

Create a .env file with the following variables set for your CrateDB cluster.

```
MONGO_CONN="mongodb+srv://..."
SQL_ENDPOINT='https://foo.bar:4200/_sql'
AUTH='username:password'
```
