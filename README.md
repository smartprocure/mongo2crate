# Mongo to Crate

```typescript
import { convertSchema } from 'mongo-to-crate'

const obj = {
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
  },
}

convertSchema(obj, 'foo')
```

Output:

```
CREATE TABLE doc.foo (
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
  "integrations" OBJECT(STRICT) AS (
    "stripe" OBJECT(STRICT) AS (
      "priceId" INTEGER,
      "subscriptionStatus" TEXT
    )
  )
)
```
