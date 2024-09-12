import { JSONSchema } from 'mongochangestream'
import type { ChangeStreamDocument } from 'mongodb'

interface RenameOption {
  /** Dotted path to renamed dotted path */
  rename?: Record<string, string>
}

export interface ImmutableOption {
  /**
   * If the collection is immutable set this to true. This allows batch processing
   * where all change stream events are assumed to be inserts.
   */
  immutable?: boolean
}

export interface SyncOptions extends RenameOption {
  schemaName?: string
  tableName?: string
}

export interface Override extends Record<string, any> {
  path: string
  mapper?: (obj: JSONSchema, path: string) => JSONSchema
  flags?: string[]
}

export interface ConvertOptions extends RenameOption {
  omit?: string[]
  overrides?: Override[]
}

export type Events = 'process' | 'error'

type OperationCounts = Partial<Record<ChangeStreamDocument['operationType'], number>>

interface BaseProcessEvent {
  type: 'process'
  failedRecords: unknown[]
  operationCounts: OperationCounts
}

interface InitialScanProcessEvent extends BaseProcessEvent {
  initialScan: true
}

interface ChangeStreamProcessEvent extends BaseProcessEvent {
  changeStream: true
}

export type ProcessEvent = InitialScanProcessEvent | ChangeStreamProcessEvent

interface BaseErrorEvent {
  type: 'error'
  error: unknown
}

interface InitialScanErrorEvent extends BaseErrorEvent {
  initialScan: true
}

interface ChangeStreamErrorEvent extends BaseErrorEvent {
  changeStream: true
}

export type ErrorEvent = InitialScanErrorEvent | ChangeStreamErrorEvent
