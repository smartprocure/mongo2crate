# Mongo to Crate

## Sync MongoDB to Crate

```typescript
import { initSync, crate, defaultDocMapper, omitFields } from 'mongo2crate'
import { default as Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import retry from 'p-retry'
import _ from 'lodash/fp.js'

const client = await MongoClient.connect()
const db = client.db()

// Optionally, extend the default mapper to omit certain fields
const docMapper = _.flow(
  defaultDocMapper,
  omitFields(['password', 'unneededStuff'])
)

const sync = initSync(
  new Redis({ keyPrefix: 'cratedb:' }),
  crate(),
  db.collection('myCollection'),
  docMapper
)
// Process change stream events
sync.processChangeStream()
// Run initial scan of collection batching documents by 1000
const options = { batchSize: 1000 }
retry(() => sync.runInitialScan(options))
```

## Convert a JSON schema to Crate DDL

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
      enum: ['1 - 5', '6 - 20', '21 - 50', '51 - 200', '201 - 500', '500+'],
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

convertSchema(schema, 'fooBar')
```

Output:

```
CREATE TABLE IF NOT EXISTS doc."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
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
        "country" TEXT
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
