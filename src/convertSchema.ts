import { getDupes } from 'dupes-of-hazard'
import lodash from 'lodash'
import _ from 'lodash/fp.js'
import makeError from 'make-error'
import { minimatch } from 'minimatch'
import { type JSONSchema, traverseSchema } from 'mongochangestream'
import util from 'node:util'
import { type Node, walk } from 'obj-walker'

import type { ConvertOptions, Override } from './types.js'
import { arrayStartsWith } from './util.js'

export const Mongo2CrateError = makeError('Mongo2CrateError')

const bsonTypeToSQL: Record<string, string> = {
  number: 'BIGINT', // 64-bit
  double: 'DOUBLE PRECISION', // 64-bit
  int: 'INTEGER',
  long: 'BIGINT',
  decimal: 'DOUBLE PRECISION',
  objectId: 'TEXT',
  string: 'TEXT',
  date: 'TIMESTAMP WITH TIME ZONE',
  timestamp: 'TIMESTAMP WITH TIME ZONE',
  bool: 'BOOLEAN',
  object: 'OBJECT(IGNORED)',
  null: 'TEXT',
  undefined: 'TEXT',
  regex: 'TEXT',
  symbol: 'TEXT',
  javascript: 'TEXT',
}

const convertType = (bsonType: string | string[]) => {
  if (Array.isArray(bsonType)) {
    bsonType = bsonType[0]
  }
  return bsonTypeToSQL[bsonType]
}

const flagToSQL: Record<string, string> = {
  indexOff: 'INDEX OFF',
  columnStoreOff: 'STORAGE WITH (columnstore = false)',
  notNull: 'NOT NULL',
}

const flagsToSql = (flags?: string[]) =>
  flags && flags.length
    ? ' ' + flags.map((flag) => flagToSQL[flag]).join(' ')
    : ''

const renderCommaIf = (cond: boolean) => (cond ? ',' : '')
const padding = '  '

const columnPolicy = (policy: string) => ` WITH (column_policy = '${policy}')`

const getObjectPolicy = (node: Node, strictMode: boolean) => {
  const noAdditionalProps = node.val.additionalProperties === false
  if (strictMode && noAdditionalProps) {
    return 'strict'
  }
  return 'dynamic'
}

const _convertSchema = (
  nodes: Node[],
  strictMode = false,
  spacing = ''
): string => {
  let returnVal = ''
  while (true) {
    const node = nodes[0]
    if (!node) {
      return returnVal
    }
    const isPrimaryKey = _.equals(node.path, ['id'])
    const field = node.key === '_items' ? '' : `"${node.key}" `
    // Create table
    if (node.isRoot) {
      return (
        'CREATE TABLE IF NOT EXISTS %s (\n' +
        _convertSchema(nodes.slice(1), strictMode, padding) +
        ')' +
        columnPolicy(getObjectPolicy(node, strictMode))
      )
    }
    // Scalar fields, including objects with no defined fields
    if (node.isLeaf) {
      const comma = renderCommaIf(nodes.length > 1)
      const sqlType = convertType(node.val.bsonType)
      const primary = isPrimaryKey ? ' PRIMARY KEY' : ''
      const modifiers = flagsToSql(node.val.flags)
      returnVal += `${spacing}${field}${sqlType}${primary}${modifiers}${comma}\n`
      nodes = nodes.slice(1)
    }
    // Arrays and objects
    else {
      const index = _.findLastIndex(
        (n) => arrayStartsWith(n.path, node.path),
        nodes
      )
      const childNodes = nodes.slice(1, index + 1)
      const newSpacing = spacing + padding
      const comma = renderCommaIf(nodes.length - childNodes.length > 1)
      const sqlType =
        node.val.bsonType === 'array'
          ? 'ARRAY'
          : `OBJECT(${getObjectPolicy(node, strictMode).toUpperCase()}) AS`
      returnVal +=
        `${spacing}${field}${sqlType} (\n` +
        _convertSchema(childNodes, strictMode, newSpacing) +
        `${spacing})${comma}\n`
      nodes = nodes.slice(index + 1)
    }
  }
}

export type ConvertSchema = (
  jsonSchema: JSONSchema,
  qualifiedName: string,
  options?: ConvertOptions
) => string

const omitNodes = (nodes: Node[], omit: string[]) =>
  _.remove(
    ({ path }) =>
      _.find((omitPath) => arrayStartsWith(path, _.toPath(omitPath)), omit),
    nodes
  )

const handleOverrides = (nodes: Node[], overrides: Override[]) => {
  for (const node of nodes) {
    const stringPath = node.path.join('.')
    const overrideMatch = overrides.find(({ path }) =>
      minimatch(stringPath, path)
    )
    if (overrideMatch) {
      const mapper = overrideMatch.mapper
      lodash.update(node, 'val', (obj) => ({
        ...(mapper ? mapper(obj, stringPath) : obj),
        ...overrideMatch,
      }))
    }
  }
}

/**
 * Modify path and key for relevant nodes.
 */
const handleRename = (nodes: Node[], rename: Record<string, string>) => {
  for (const dottedPath in rename) {
    const oldPath = dottedPath.split('.')
    const newPath = rename[dottedPath].split('.')
    if (!arrayStartsWith(oldPath, newPath.slice(0, -1))) {
      throw new Mongo2CrateError(
        `Rename path prefix does not match: ${dottedPath}`
      )
    }
    for (const node of nodes) {
      if (arrayStartsWith(node.path, oldPath)) {
        node.path.splice(0, oldPath.length, ...newPath)
        node.key = node.path.at(-1)
      }
    }
  }
  const paths = nodes
    // Remove _items nodes since the paths are always duplicated
    .filter((node) => node.key !== '_items')
    .map((node) => node.path)
  const dupes = getDupes(paths)

  if (dupes.size) {
    throw new Mongo2CrateError(
      `Duplicate paths found: ${Array.from(dupes).join(', ')}`
    )
  }
}
const cleanupPath = _.update('path', _.pull('_items'))

/**
 * Convert MongoDB JSON schema to CrateDB table DDL.
 * Optionally, omit fields, rename fields, and change the BSON type for fields.
 * The latter is useful where a more-specific numeric type is needed.
 */
export const convertSchema: ConvertSchema = (
  jsonSchema,
  qualifiedName,
  options = {}
) => {
  let nodes: Node[] = walk(jsonSchema, { traverse: traverseSchema }).map(
    cleanupPath
  )
  if (options.omit) {
    nodes = omitNodes(nodes, options.omit)
  }
  handleRename(nodes, { ...options.rename, _id: 'id' })
  if (options.overrides) {
    handleOverrides(nodes, options.overrides)
  }
  const sqlSchema = _convertSchema(nodes, options.strictMode)
  return util.format(sqlSchema, qualifiedName)
}
