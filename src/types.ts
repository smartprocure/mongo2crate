import { Document } from 'mongodb'

export interface SyncOptions {
  mapper?: (doc: Document) => Document
}

export type Path = string | string[]

export interface Override {
  path: Path
  bsonType: string
}

export interface ConvertOptions {
  omit?: Path[]
  overrides?: Override[]
}
