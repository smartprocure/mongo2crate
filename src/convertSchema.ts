import _ from 'lodash/fp.js'
import { Node, walk } from 'obj-walker'
import util from 'node:util'
import { arrayStartsWith } from './util.js'

const bsonTypeToSQL: Record<string, string> = {
  objectId: 'TEXT',
  string: 'TEXT',
  date: 'TIMESTAMP WITH TIME ZONE',
  number: 'INTEGER',
  bool: 'BOOLEAN',
  object: 'OBJECT(IGNORED)',
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

type ConvertSchema = (
  jsonSchema: object,
  tableName: string,
  omit?: string[]
) => string

const omitNodes = (nodes: Node[], omit: string[]) =>
  _.remove(
    ({ path }) =>
      _.find((omitPath) => arrayStartsWith(path, _.toPath(omitPath)), omit),
    nodes
  )

/**
 * Convert jsonSchema to Crate table DDL
 */
export const convertSchema: ConvertSchema = (jsonSchema, tableName, omit) => {
  let nodes = walk(jsonSchema, { traverse })
  if (omit) {
    nodes = omitNodes(nodes, omit)
  }
  const sqlSchema = _convertSchema(nodes)
  return util.format(sqlSchema, tableName.toLowerCase())
}
