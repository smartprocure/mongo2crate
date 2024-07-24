import _ from 'lodash/fp.js'

import { setDefaults } from '../util.js'

export const maybeShowColTypes = (endpoint: string, coltypes: boolean) =>
  coltypes ? `${endpoint}?types` : endpoint

export const getInsertColsAndPlaceholders = (fields: string[]) => {
  const columns = fields.map((col) => `"${col}"`).join(',')
  const placeholders = _.repeat(fields.length - 1, '?,') + '?'
  return { columns, placeholders }
}

export const quoteColumn = (column: string) => {
  const [first, ...rest] = column.split('.')
  let quoted = `"${first}"`
  if (rest.length) {
    for (const inner of rest) {
      quoted += `['${inner}']`
    }
  }
  return quoted
}

/**
 * Given an update object return placeholder assignments and update values
 */
export const getAssignmentsAndUpdates = (
  record: Record<string, any>,
  update: Record<string, any>
) => {
  const placeholders: string[] = []
  const updates: any[] = []
  const columns = Object.keys(update)
  for (const column of columns) {
    // Numeric index so replace the entire value from the root of the nested path
    if (/\.[0-9]+/.test(column)) {
      const [first] = column.split('.')
      placeholders.push(`${quoteColumn(first)} = ?`)
      updates.push(record[first])
    } else {
      placeholders.push(`${quoteColumn(column)} = ?`)
      updates.push(update[column])
    }
  }
  return { assignments: placeholders.join(','), updates }
}

export const getUniqueKeys = (records: object[]) => {
  const keys = new Set<string>()
  // Get all the unique top-level keys
  records.forEach((rec) => Object.keys(rec).forEach((key) => keys.add(key)))
  // Sort keys so that the order is deterministic
  return Array.from(keys).sort()
}

export const getInsertSqlAndArgs = (qualifiedName: string, record: object) => {
  const keys = Object.keys(record)
  const { columns, placeholders } = getInsertColsAndPlaceholders(keys)
  const sql = `INSERT INTO ${qualifiedName} (${columns}) VALUES (${placeholders})`
  const args = Object.values(record)
  return { sql, args }
}

export const getDeleteByIdSqlAndArgs = (qualifiedName: string, id: string) => {
  const sql = `DELETE FROM ${qualifiedName} WHERE id = ?`
  const args = [id]
  return { sql, args }
}

export const getBulkInsertSqlAndArgs = (
  qualifiedName: string,
  records: object[]
) => {
  // Get the set of unique keys across all the records
  const keys = getUniqueKeys(records)
  const defaults = setDefaults(keys, null)
  const { columns, placeholders } = getInsertColsAndPlaceholders(keys)
  const sql = `INSERT INTO ${qualifiedName} (${columns}) VALUES (${placeholders})`
  const args = records.map(
    _.flow(_.defaults(defaults), _.toPairs, _.sortBy(_.head), _.map(_.last))
  )
  return { sql, args }
}

export const getUpsertSqlAndArgs = (
  qualifiedName: string,
  record: object,
  update: object
) => {
  const keys = Object.keys(record)
  const { columns, placeholders } = getInsertColsAndPlaceholders(keys)
  const { assignments, updates } = getAssignmentsAndUpdates(record, update)
  const sql = `INSERT INTO ${qualifiedName} (${columns}) VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${assignments}`
  const args = [...Object.values(record), ...updates]
  return { sql, args }
}

export const getAuthHeader = (auth: string) => ({
  Authorization: 'Basic ' + Buffer.from(auth, 'binary').toString('base64'),
})
