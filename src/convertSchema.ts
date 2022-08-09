import _ from 'lodash/fp.js'
import { Node, walk } from 'obj-walker'
import util from 'node:util'

/**
 * Does arr start with startsWith array.
 */
const arrayStartsWith = (arr: any[], startsWith: any[]) => {
  for (let i = 0; i < startsWith.length; i++) {
    if (arr[i] !== startsWith[i]) {
      return false
    }
  }

  return true
}

const bsonTypeToSQL: Record<string, string> = {
  objectId: 'TEXT',
  string: 'TEXT',
  date: 'TIMESTAMP WITH TIME ZONE',
  number: 'INTEGER',
  bool: 'BOOLEAN',
  object: 'OBJECT(IGNORED)'
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
        'CREATE TABLE doc.%s (\n' +
        _convertSchema(nodes.slice(1), padding) +
        ')'
      )
    }
    // Scalar fields
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
        node.val.bsonType === 'array' ? 'ARRAY' : 'OBJECT(STRICT) AS'
      returnVal +=
        `${spacing}${field}${sqlType} (\n` +
        _convertSchema(childNodes, newSpacing) +
        `${spacing})${comma}\n`
      nodes = nodes.slice(index + 1)
    }
  }
}

const traverse = (x: any) => x.properties || (x.items && { _items: x.items })

/**
 * Convert jsonSchema to Crate table DDL
 */
export const convertSchema = (jsonSchema: object, tableName: string) => {
  const nodes = walk(jsonSchema, { traverse })
  const sqlSchema = _convertSchema(nodes)
  return util.format(sqlSchema, tableName)
}
