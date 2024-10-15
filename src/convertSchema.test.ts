import _ from 'lodash/fp.js'
import { describe, expect, it } from 'vitest'

import { convertSchema } from './convertSchema.js'

const schema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['name', 'type'],
  properties: {
    _id: {
      bsonType: 'objectId',
    },
    name: { bsonType: ['string', 'null'] },
    description: { bsonType: 'string' },
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

describe('convertSchema', () => {
  it('should convert the schema', () => {
    const sql = convertSchema(schema, '"doc"."foobar"')
    expect(sql).toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "numberOfEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(DYNAMIC) AS (
      "address" OBJECT(DYNAMIC) AS (
        "street" TEXT,
        "city" TEXT,
        "county" TEXT,
        "state" TEXT,
        "zip" TEXT,
        "country" TEXT,
        "latitude" BIGINT,
        "longitude" BIGINT
      ),
      "name" TEXT,
      "isPrimary" BOOLEAN
    )
  ),
  "integrations" OBJECT(DYNAMIC) AS (
    "stripe" OBJECT(DYNAMIC) AS (
      "priceId" BIGINT,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'dynamic')`)
  })
  it('should convert the schema with strictMode enabled', () => {
    expect(convertSchema(schema, '"doc"."foobar"', { strictMode: true }))
      .toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
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
        "latitude" BIGINT,
        "longitude" BIGINT
      ),
      "name" TEXT,
      "isPrimary" BOOLEAN
    )
  ),
  "integrations" OBJECT(DYNAMIC) AS (
    "stripe" OBJECT(DYNAMIC) AS (
      "priceId" BIGINT,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'strict')`)
  })
  it('should omit fields from the schema', () => {
    expect(
      convertSchema(schema, '"doc"."foobar"', {
        omit: ['addresses.address.country', 'integrations'],
      })
    ).toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "numberOfEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(DYNAMIC) AS (
      "address" OBJECT(DYNAMIC) AS (
        "street" TEXT,
        "city" TEXT,
        "county" TEXT,
        "state" TEXT,
        "zip" TEXT,
        "latitude" BIGINT,
        "longitude" BIGINT
      ),
      "name" TEXT,
      "isPrimary" BOOLEAN
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'dynamic')`)
  })
  it('should override bsonType and convert flags', () => {
    const result = convertSchema(schema, '"doc"."foobar"', {
      overrides: [
        // Glob expression
        { path: 'addresses.address.l*', bsonType: 'double' },
        {
          path: 'description',
          flags: ['notNull', 'indexOff', 'columnStoreOff'],
        },
        {
          path: 'numberOfEmployees',
          flags: [],
        },
      ],
    })
    expect(result).toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT NOT NULL INDEX OFF STORAGE WITH (columnstore = false),
  "numberOfEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(DYNAMIC) AS (
      "address" OBJECT(DYNAMIC) AS (
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
      "priceId" BIGINT,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'dynamic')`)
  })
  it('should convert with mapper', () => {
    const result = convertSchema(schema, '"doc"."foobar"', {
      overrides: [
        {
          path: '*',
          mapper: (obj) => {
            if (obj.bsonType === 'number') {
              return { ...obj, bsonType: 'double' }
            }
            return obj
          },
        },
      ],
    })
    expect(result).toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "numberOfEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(DYNAMIC) AS (
      "address" OBJECT(DYNAMIC) AS (
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
      "priceId" DOUBLE PRECISION,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'dynamic')`)
  })
  it('should apply multiple overrides in sequence', () => {
    const result = convertSchema(schema, '"doc"."foobar"', {
      overrides: [
        // First, change this field from TEXT to BIGINT
        {
          path: '*.zip',
          bsonType: 'number',
        },
        // Then, change all BIGINT fields (including the one above) to DOUBLE
        // PRECISION
        {
          path: '*',
          mapper: (obj) => {
            if (obj.bsonType === 'number') {
              return { ...obj, bsonType: 'double' }
            }
            return obj
          },
        },
        // Then, change this field back to BIGINT
        {
          path: 'addresses.address.latitude',
          bsonType: 'number',
        },
      ],
    })
    expect(result).toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "numberOfEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(DYNAMIC) AS (
      "address" OBJECT(DYNAMIC) AS (
        "street" TEXT,
        "city" TEXT,
        "county" TEXT,
        "state" TEXT,
        "zip" DOUBLE PRECISION,
        "country" TEXT,
        "latitude" BIGINT,
        "longitude" DOUBLE PRECISION
      ),
      "name" TEXT,
      "isPrimary" BOOLEAN
    )
  ),
  "integrations" OBJECT(DYNAMIC) AS (
    "stripe" OBJECT(DYNAMIC) AS (
      "priceId" DOUBLE PRECISION,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'dynamic')`)
  })
  it('should rename fields in the schema', () => {
    const result = convertSchema(schema, '"doc"."foobar"', {
      rename: {
        numberOfEmployees: 'numEmployees',
        'integrations.stripe.subscriptionStatus': 'integrations.stripe.status',
        'addresses.address': 'addresses.address1',
      },
    })
    expect(result).toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "numEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(DYNAMIC) AS (
      "address1" OBJECT(DYNAMIC) AS (
        "street" TEXT,
        "city" TEXT,
        "county" TEXT,
        "state" TEXT,
        "zip" TEXT,
        "country" TEXT,
        "latitude" BIGINT,
        "longitude" BIGINT
      ),
      "name" TEXT,
      "isPrimary" BOOLEAN
    )
  ),
  "integrations" OBJECT(DYNAMIC) AS (
    "stripe" OBJECT(DYNAMIC) AS (
      "priceId" BIGINT,
      "status" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'dynamic')`)
  })
  it('should throw an exception if a rename field path prefix is different', () => {
    expect(() =>
      convertSchema(schema, '"doc"."foobar"', {
        rename: {
          'integrations.stripe': 'foo.bar',
        },
      })
    ).toThrow('Rename path prefix does not match: integrations.stripe')
  })
  it('should throw an exception if a rename results in duplicate paths', () => {
    expect(() =>
      convertSchema(schema, '"doc"."foobar"', {
        rename: {
          description: 'name',
        },
      })
    ).toThrow('Duplicate paths found: name')
  })
  describe('the `mapSchema` option', () => {
    it('can replace a leaf node', () => {
      expect(
        convertSchema(schema, '"doc"."foobar"', {
          mapSchema: ({ path, val }) => {
            if (
              _.isEqual(path, [
                'properties',
                'addresses',
                'items',
                'properties',
                'address',
                'properties',
                'zip',
                'bsonType',
              ])
            ) {
              // Was originally 'string'. In the expected output below, TEXT is
              // replaced with BIGINT.
              return 'number'
            }

            return val
          },
        })
      ).toEqual(
        `CREATE TABLE IF NOT EXISTS "doc"."foobar" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "numberOfEmployees" TEXT,
  "notificationPreferences" ARRAY (
    TEXT
  ),
  "addresses" ARRAY (
    OBJECT(DYNAMIC) AS (
      "address" OBJECT(DYNAMIC) AS (
        "street" TEXT,
        "city" TEXT,
        "county" TEXT,
        "state" TEXT,
        "zip" BIGINT,
        "country" TEXT,
        "latitude" BIGINT,
        "longitude" BIGINT
      ),
      "name" TEXT,
      "isPrimary" BOOLEAN
    )
  ),
  "integrations" OBJECT(DYNAMIC) AS (
    "stripe" OBJECT(DYNAMIC) AS (
      "priceId" BIGINT,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
) WITH (column_policy = 'dynamic')`
      )
    })
  })
})
