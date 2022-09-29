import _ from 'lodash/fp.js'
import { setDefaults } from '../util.js'

export const maybeShowColTypes = (endpoint: string, coltypes: boolean) =>
  coltypes ? `${endpoint}?types` : endpoint

export const getInsertColsAndPlaceholders = (fields: string[]) => {
  const columns = fields.map((col) => `"${col}"`).join(',')
  const placeholders = _.repeat(fields.length - 1, '?,') + '?'
  return { columns, placeholders }
}

export const getAssignments = (obj: object) => {
  const keys = Object.keys(obj)
  const assignments = keys.map((col) => `"${col}" = ?`).join(',')
  return { assignments }
}

export const getUniqueKeys = (records: object[]) => {
  const keys = new Set<string>()
  // Get all the unique top-level keys
  records.forEach((rec) => Object.keys(rec).forEach((key) => keys.add(key)))
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
  const { assignments } = getAssignments(update)
  const sql = `INSERT INTO ${qualifiedName} (${columns}) VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${assignments}`
  const args = [...Object.values(record), ...Object.values(update)]
  return { sql, args }
}

export const getAuthHeader = (auth: string) => ({
  Authorization: 'Basic ' + Buffer.from(auth, 'binary').toString('base64'),
})
