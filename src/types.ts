import { JSONSchema } from 'mongochangestream'
import type { ChangeStreamDocument, Document } from 'mongodb'

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
  /**
   * Enable to take into account `additionalProperties`. Otherwise,
   * all objects allow for dynamic fields. In both cases, objects
   * with no defined properties are set to `OBJECT(IGNORED)`.
   */
  strictMode?: boolean
}

export type Events = 'process' | 'error'

type OperationCounts = Partial<
  Record<ChangeStreamDocument['operationType'], number>
>

interface BaseProcessEvent {
  type: 'process'
  failedDocs?: Document[]
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
  failedDoc?: Document
}

export type ErrorEvent = InitialScanErrorEvent | ChangeStreamErrorEvent
