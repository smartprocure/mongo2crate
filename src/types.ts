import type { Document } from 'mongodb'
import { JSONSchema } from 'mongochangestream'

export interface SyncOptions {
  mapper?: (doc: Document) => Document
  schemaName?: string
  tableName?: string
}

export interface Override extends Record<string, any> {
  path: string
  mapper?: (obj: JSONSchema, path: string) => JSONSchema
  flags?: string[]
}

export interface ConvertOptions {
  omit?: string[]
  overrides?: Override[]
}

export type Events = 'process' | 'error'
