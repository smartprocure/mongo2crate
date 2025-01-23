import { JSONSchema } from 'mongochangestream'
import type { ChangeStreamDocument } from 'mongodb'
import { Mapper, Node } from 'obj-walker'

interface RenameOption {
  /** Dotted path to renamed dotted path */
  rename?: Record<string, string>
}

export interface OptimizationOptions {
  /**
   * Automatically optimize inserts by batching them together and flushing
   * the insert queue when a non-insert event is received or a queue threshold
   * is met - length, size in bytes, timeout, etc.
   */
  autoOptimizeInserts?: boolean
}

export interface SyncOptions extends RenameOption {
  schemaName?: string
  tableName?: string
  /**
   * Map over values (leaf nodes). This can be used to limit
   * the length of strings since there is a 32k character limit
   * for text fields with the default columnar index.
   * @example
   * ```typescript
   * const mapper = (node: Node) => {
   *   if (typeof node.val === 'string') {
   *     return node.val.slice(0, 250)
   *   }
   *   return node.val
   * }
   * ```
   */
  mapper?: (node: Node) => unknown
}

export interface Override extends Record<string, any> {
  path: string
  mapper?: (obj: JSONSchema, path: string) => JSONSchema
  flags?: string[]
}

export interface ConvertOptions extends RenameOption {
  /**
   * An obj-walker Mapper function that can be used as an "escape hatch" to
   * preprocess each node in the object (using `map`) before using `walk` to
   * convert the object into the output Crate schema.
   *
   * This can be useful in situations where you want to replace or remove a
   * non-leaf node.
   *
   * @example
   * ```typescript
   * const mapSchema = ({ path, val }) => {
   *   if (_.isEqual(path, ['properties', 'addresses', 'items'])) {
   *     // This should result in OBJECT(IGNORED), since there are no
   *     // properties.
   *     return { bsonType: 'object' }
   *   }
   *
   *   return val
   * }
   * ```
   */
  mapSchema?: Mapper
  omit?: string[]
  overrides?: Override[]
  /**
   * Enable to take into account `additionalProperties`. Otherwise,
   * all objects allow for dynamic fields. In both cases, objects
   * with no defined properties are set to `OBJECT(IGNORED)`.
   */
  strictMode?: boolean
}

export type Events = 'process'

type OperationCounts = Partial<
  Record<ChangeStreamDocument['operationType'], number>
>

interface BaseProcessEvent {
  type: 'process'
  success: number
  fail: number
  /** _id of failed documents */
  failedDocs?: unknown[]
  operationCounts: OperationCounts
}

export interface InitialScanProcessEvent extends BaseProcessEvent {
  initialScan: true
}

export interface ChangeStreamProcessEvent extends BaseProcessEvent {
  changeStream: true
}

export type ProcessEvent = InitialScanProcessEvent | ChangeStreamProcessEvent

export interface ErrorLike {
  message?: string
}
