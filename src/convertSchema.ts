import _ from 'lodash/fp.js'
import { Node, walk } from 'obj-walker'
import util from 'node:util'
import { arrayStartsWith } from './util.js'
import { Override, ConvertOptions } from './types.js'
import { JSONSchema, traverseSchema } from 'mongochangestream'
import { minimatch } from 'minimatch'

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

const _convertSchema = (nodes: Node[], spacing = ''): string => {
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
        _convertSchema(nodes.slice(1), padding) +
        ')' +
        (node.val.additionalProperties
          ? " WITH (column_policy = 'dynamic')"
          : '')
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
          : `OBJECT(${
              node.val.additionalProperties === false ? 'STRICT' : 'DYNAMIC'
            }) AS`
      returnVal +=
        `${spacing}${field}${sqlType} (\n` +
        _convertSchema(childNodes, newSpacing) +
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
  const overriden: Node[] = []
  for (const node of nodes) {
    const stringPath = node.path.join('.')
    const overrideMatch = overrides.find(({ path }) =>
      minimatch(stringPath, path)
    )
    if (overrideMatch) {
      const mapper = overrideMatch.mapper
      overriden.push(
        _.update(
          'val',
          (obj) => ({
            ...(mapper ? mapper(obj, stringPath) : obj),
            ...overrideMatch,
          }),
          node
        )
      )
    } else {
      overriden.push(node)
    }
  }
  return overriden
}

const handleRename = (nodes: Node[], rename: Record<string, string>) => {
  for (const node of nodes) {
    const dottedPath = node.path.join('.')
    if (Object.hasOwn(rename, dottedPath)) {
      const newPath = rename[dottedPath].split('.')
      // Check if path prefixes do not match
      if (!_.isEqual(node.path.slice(0, -1), newPath.slice(0, -1))) {
        throw new Error(`Rename path prefix does not match: ${dottedPath}`)
      }
      node.path = newPath
      node.key = newPath.at(-1)
    }
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
  let nodes = walk(jsonSchema, { traverse: traverseSchema }).map(cleanupPath)
  if (options.omit) {
    nodes = omitNodes(nodes, options.omit)
  }
  handleRename(nodes, { ...options.rename, _id: 'id' })
  if (options.overrides) {
    nodes = handleOverrides(nodes, options.overrides)
  }
  const sqlSchema = _convertSchema(nodes)
  return util.format(sqlSchema, qualifiedName)
}
