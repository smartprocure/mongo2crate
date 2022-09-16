import { Document } from 'mongodb'

export interface SyncOptions {
  mapper?: (doc: Document) => Document
}

export interface Override {
  path: string
  bsonType: string
}

export interface ConvertOptions {
  omit?: string[]
  overrides?: Override[]
}
