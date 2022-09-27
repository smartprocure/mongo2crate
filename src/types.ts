import type { Document } from 'mongodb'

export interface SyncOptions {
  mapper?: (doc: Document) => Document
  tableName?: string
}

export interface Override {
  path: string
  bsonType: string
}

export interface ConvertOptions {
  omit?: string[]
  overrides?: Override[]
}
