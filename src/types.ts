import type { Document } from 'mongodb'

export interface SyncOptions {
  mapper?: (doc: Document) => Document
  schemaName?: string
  tableName?: string
}

export interface Override {
  path: string
  bsonType?: string
  flags?: string[]
}

export interface ConvertOptions {
  omit?: string[]
  overrides?: Override[]
}

export type Events = 'process' | 'error'
