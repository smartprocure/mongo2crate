import { Document } from 'mongodb'

export interface SyncOptions {
  mapper?: (doc: Document) => Document
}
