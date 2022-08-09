import _ from 'lodash/fp.js'
import fetch from 'node-fetch'
import _debug from 'debug'

const debug = _debug('mongo-to-crate')

export interface QueryResult {
  cols: string[]
  col_types?: number[]
  rows: any[][]
  rowcount: number
  duration: number
}

export interface BulkQueryResult {
  cols: string[]
  results: {
    rowcount: number
  }[]
  duration: number
}

export interface ErrorResult {
  error: {
    message: string
    code: number
  }
}

export interface Options {
  args?: any[]
  coltypes?: boolean
}

const maybeShowColTypes = (endpoint: string, coltypes: boolean) =>
  coltypes ? `${endpoint}?types` : endpoint

export const getInsertColsAndPlaceholders = (obj: object) => {
  const keys = Object.keys(obj)
  const columns = keys.map((col) => `"${col}"`).join(',')
  const placeholders = _.repeat(keys.length - 1, '?,') + '?'
  return { columns, placeholders }
}

export const getUpdateColsAndPlaceholders = (obj: object) => {
  const keys = Object.keys(obj)
  const assignments = keys.map((col) => `"${col}" = ?`).join(',')
  return { assignments }
}

export const crate = (sqlEndpoint = 'http://localhost:4200/_sql') => {
  const query = (sql: string, { args, coltypes = false }: Options) => {
    debug('query - sql %s args %O', sql, args)
    return fetch(maybeShowColTypes(sqlEndpoint, coltypes), {
      method: 'post',
      body: JSON.stringify({ stmt: sql, ...(args && { args }) }),
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => res.json() as Promise<QueryResult | ErrorResult>)
  }

  const insert = (tableName: string, record: object) => {
    const { columns, placeholders } = getInsertColsAndPlaceholders(record)
    const sql = `INSERT INTO doc.${tableName} (${columns}) VALUES (${placeholders})`
    return query(sql, { args: Object.values(record) })
  }

  const upsert = (tableName: string, record: object, update: object) => {
    const { columns, placeholders } = getInsertColsAndPlaceholders(record)
    const { assignments } = getUpdateColsAndPlaceholders(update)
    const sql = `INSERT INTO doc.${tableName} (${columns}) VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${assignments}`
    return query(sql, {
      args: [...Object.values(record), ...Object.values(update)],
    })
  }

  const deleteById = (tableName: string, id: string) => {
    const sql = `DELETE FROM doc.${tableName} WHERE id = ?`
    return query(sql, { args: [id] })
  }

  const bulkInsert = (tableName: string, records: object[]) => {
    const { columns, placeholders } = getInsertColsAndPlaceholders(records[0])
    const sql = `INSERT INTO doc.${tableName} (${columns}) VALUES (${placeholders})`
    const bulkArgs = records.map(Object.values)
    debug('bulkInsert - sql %s bulk_args %O', sql, bulkArgs)
    return fetch(sqlEndpoint, {
      method: 'post',
      body: JSON.stringify({
        stmt: sql,
        ...(bulkArgs && { bulk_args: bulkArgs }),
      }),
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => res.json() as Promise<BulkQueryResult | ErrorResult>)
  }

  return { query, insert, upsert, bulkInsert, deleteById }
}

export type Crate = ReturnType<typeof crate>
