import _ from 'lodash/fp.js'
import { Node, walk } from 'obj-walker'
import util from 'node:util'
import { arrayStartsWith } from './util.js'
import { Override, ConvertOptions } from './types.js'

const bsonTypeToSQL: Record<string, string> = {
  number: 'INTEGER',
  double: 'DOUBLE PRECISION',
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

const showCommaIf = (cond: boolean) => (cond ? ',' : '')
const padding = '  '

const _convertSchema = (nodes: Node[], spacing = ''): string => {
  let returnVal = ''
  while (true) {
    const node = nodes[0]
    if (!node) {
      return returnVal
    }
    const isPrimaryKey = _.equals(node.path, ['_id'])
    const field = isPrimaryKey
      ? '"id" '
      : node.key === '_items'
      ? ''
      : `"${node.key}" `
    // Create table
    if (node.isRoot) {
      return (
        'CREATE TABLE IF NOT EXISTS doc."%s" (\n' +
        _convertSchema(nodes.slice(1), padding) +
        ')'
      )
    }
    // Scalar fields, including objects with no defined fields
    if (node.isLeaf) {
      const comma = showCommaIf(nodes.length > 1)
      const sqlType = convertType(node.val.bsonType)
      const primary = isPrimaryKey ? ' PRIMARY KEY' : ''
      returnVal += `${spacing}${field}${sqlType}${primary}${comma}\n`
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
      const comma = showCommaIf(nodes.length - childNodes.length > 1)
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

const traverse = (x: any) => x.properties || (x.items && { _items: x.items })

export type ConvertSchema = (
  jsonSchema: object,
  tableName: string,
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
    const overrideMatch = overrides.find(({ path }) =>
      _.isEqual(node.path, _.toPath(path))
    )
    if (overrideMatch) {
      overriden.push(_.set('val.bsonType', overrideMatch.bsonType, node))
    } else {
      overriden.push(node)
    }
  }
  return overriden
}

const cleanupPath = _.update('path', _.pull('_items'))

/**
 * Convert jsonSchema to CrateDB table DDL
 */
export const convertSchema: ConvertSchema = (
  jsonSchema,
  tableName,
  options
) => {
  let nodes = walk(jsonSchema, { traverse })
  if (options?.omit) {
    nodes = omitNodes(nodes.map(cleanupPath), options.omit)
  }
  if (options?.overrides) {
    nodes = handleOverrides(nodes.map(cleanupPath), options.overrides)
  }
  const sqlSchema = _convertSchema(nodes)
  return util.format(sqlSchema, tableName.toLowerCase())
}
