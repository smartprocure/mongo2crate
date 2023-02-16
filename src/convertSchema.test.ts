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

const dynamicColumnSchema = {
  bsonType: 'object',
  additionalProperties: true,
  required: ['name'],
  properties: {
    _id: {
      bsonType: 'objectId',
    },
    name: { bsonType: ['string', 'null'] },
  },
}

describe('convertSchema', () => {
  it('should convert the schema', () => {
    expect(convertSchema(schema, '"doc"."foobar"'))
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
)`)
  })
  it('should convert the schema with dynamic column policy', () => {
    expect(convertSchema(dynamicColumnSchema, '"doc"."foobar_dynamic"'))
      .toEqual(`CREATE TABLE IF NOT EXISTS "doc"."foobar_dynamic" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT
) WITH (column_policy = 'dynamic')`)
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
    OBJECT(STRICT) AS (
      "address" OBJECT(STRICT) AS (
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
)`)
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
      "priceId" BIGINT,
      "subscriptionStatus" TEXT
    )
  ),
  "metadata" OBJECT(IGNORED)
)`)
  })
})
