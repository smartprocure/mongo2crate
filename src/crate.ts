import fetch from 'node-fetch'
import {
  maybeShowColTypes,
  getInsertColsAndPlaceholders,
  getBulkInsertSqlAndArgs,
  getUpsertSqlAndArgs,
} from './crate-utils.js'
import _debug from 'debug'
import retry from 'p-retry'

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

export const crate = (
  sqlEndpoint = 'http://localhost:4200/_sql',
  auth?: string
) => {
  const authHeader = auth && {
    Authorization: 'Basic ' + Buffer.from(auth, 'binary').toString('base64'),
  }
  debug('Auth header %O', authHeader)

  const query = (sql: string, { args, coltypes = false }: Options) => {
    debug('query - sql %s args %O', sql, args)
    return retry(() =>
      fetch(maybeShowColTypes(sqlEndpoint, coltypes), {
        method: 'post',
        body: JSON.stringify({ stmt: sql, ...(args && { args }) }),
        headers: { 'Content-Type': 'application/json', ...authHeader },
      }).then((res) => res.json() as Promise<QueryResult | ErrorResult>)
    )
  }

  const insert = (tableName: string, record: object) => {
    const keys = Object.keys(record)
    const { columns, placeholders } = getInsertColsAndPlaceholders(keys)
    const sql = `INSERT INTO doc.${tableName} (${columns}) VALUES (${placeholders})`
    return query(sql, { args: Object.values(record) })
  }

  const upsert = (tableName: string, record: object, update: object) => {
    const { sql, args } = getUpsertSqlAndArgs(tableName, record, update)
    return query(sql, {
      args,
    })
  }

  const deleteById = (tableName: string, id: string) => {
    const sql = `DELETE FROM doc.${tableName} WHERE id = ?`
    return query(sql, { args: [id] })
  }

  const bulkInsert = (tableName: string, records: object[]) => {
    const { sql, args } = getBulkInsertSqlAndArgs(tableName, records)
    debug('bulkInsert - sql %s bulk_args %O', sql, args)
    return retry(() =>
      fetch(sqlEndpoint, {
        method: 'post',
        body: JSON.stringify({ stmt: sql, ...(args && { bulk_args: args }) }),
        headers: { 'Content-Type': 'application/json', ...authHeader },
      }).then((res) => res.json() as Promise<BulkQueryResult | ErrorResult>)
    )
  }

  return { query, insert, upsert, bulkInsert, deleteById }
}

export type Crate = ReturnType<typeof crate>
