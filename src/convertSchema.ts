import _ from 'lodash/fp.js'
import { Node, walk } from 'obj-walker'
import util from 'node:util'
import { arrayStartsWith } from './util.js'
import { Override, ConvertOptions } from './types.js'
import { JSONSchema, traverseSchema } from 'mongochangestream'
import { minimatch } from 'minimatch'
import makeError from 'make-error'
import { getDupes } from 'dupes-of-hazard'

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


/**
 * Converts a BSON type to its corresponding SQL type.
 * @param {string|string[]} bsonType - BSON type or types to convert.
 * @return {string} Corresponding SQL type.
 */
const convertType = (bsonType: string | string[]) => 
  bsonTypeToSQL[Array.isArray(bsonType) ? bsonType[0] : bsonType];

const flagToSQL: Record<string, string> = {
  indexOff: 'INDEX OFF',
  columnStoreOff: 'STORAGE WITH (columnstore = false)',
  notNull: 'NOT NULL',
}

/**
 * Converts a list of flags into their corresponding SQL modifiers.
 * @param {string[]} flags - List of flags to convert.
 * @return {string} SQL modifiers separated by spaces.
 */
const flagsToSql = (flags?: string[]) =>
  flags && flags.length
    ? ' ' + flags.map((flag) => flagToSQL[flag]).join(' ')
    : ''

/**
 * Returns a comma if the condition is true.
 * @param {boolean} cond - Condition to check.
 * @return {string} A comma if the condition is true, otherwise an empty string.
 */
const renderCommaIf = (cond: boolean) => (cond ? ',' : '')
const padding = '  '

/**
 * Recursively converts schema nodes into SQL table definitions.
 * @param {Node[]} nodes - List of schema nodes to convert.
 * @param {string} spacing - Current indentation.
 * @return {string} SQL table definition.
 */
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

/**
 * Omit certain nodes based on their path.
 * @param {Node[]} nodes - Original list of nodes.
 * @param {string[]} omit - List of paths to omit.
 * @return {Node[]} Filtered list of nodes.
 */
const omitNodes = (nodes: Node[], omit: string[]) =>
  nodes.filter(({ path }) => !omit.some((omitPath) => arrayStartsWith(path, _.toPath(omitPath))));

  /**
 * Apply overrides to the schema nodes.
 * @param {Node[]} nodes - Original list of nodes.
 * @param {Override[]} overrides - List of overrides to apply.
 * @return {Node[]} Nodes after applying overrides.
 */
const handleOverrides = (nodes: Node[], overrides: Override[]): Node[] =>
  nodes.map((node) => {
    const stringPath = node.path.join('.');
    const overrideMatch = overrides.find(({ path }) => minimatch(stringPath, path));
    return overrideMatch
      ? { ...node, val: { ...(overrideMatch.mapper ? overrideMatch.mapper(node.val, stringPath) : node.val), ...overrideMatch } }
      : node;
  });

/**
 * Rename certain nodes based on their path.
 * @param {Node[]} nodes - Original list of nodes.
 * @param {Record<string, string>} rename - Dictionary of old path to new path for renaming.
 * @return {Node[]} Nodes after renaming.
 */  
const handleRename = (nodes: Node[], rename: Record<string, string>): Node[] => {
  const renamedNodes = nodes.map((node) => {
    for (const dottedPath in rename) {
      const oldPath = dottedPath.split('.');
      const newPath = rename[dottedPath].split('.');
      if (arrayStartsWith(node.path, oldPath)) {
        return { ...node, path: [...newPath, ...node.path.slice(oldPath.length)], key: newPath[newPath.length - 1] };
      }
    }
    return node;
  });
  const paths = renamedNodes.filter((node) => node.key !== '_items').map((node) => node.path);
  const dupes = getDupes(paths);
  if (dupes.size) {
    throw new Mongo2CrateError(`Duplicate paths found: ${Array.from(dupes).join(', ')}`);
  }
  return renamedNodes;
};

/**
 * Clean up the path of a node by removing '_items'.
 * @param {Node} node - Node to clean up.
 * @return {Node} Node with cleaned up path.
 */
const cleanupPath = (node: Node): Node => ({ ...node, path: node.path.filter(p => p !== '_items') });


/**
 * Convert MongoDB JSON schema to CrateDB table DDL.
 * Optionally, omit fields, rename fields, and change the BSON type for fields.
 * @param {JSONSchema} jsonSchema - MongoDB JSON schema.
 * @param {string} qualifiedName - Full table name.
 * @param {ConvertOptions} options - Options for conversion.
 * @return {string} SQL table definition.
 */
export const convertSchema: ConvertSchema = (jsonSchema, qualifiedName, options = {}) => {
  let nodes = walk(jsonSchema, { traverse: traverseSchema }).map(cleanupPath);
  nodes = options.omit ? omitNodes(nodes, options.omit) : nodes;
  nodes = handleRename(nodes, { ...options.rename, _id: process.env.DEFAULT_TABLE_NAME || 'id' });
  nodes = options.overrides ? handleOverrides(nodes, options.overrides) : nodes;
  return util.format(_convertSchema(nodes), qualifiedName);
};