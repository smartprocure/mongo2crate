import _ from 'lodash/fp.js'
import fetch from 'node-fetch'
import {
  maybeShowColTypes,
  getInsertSqlAndArgs,
  getDeleteByIdSqlAndArgs,
  getBulkInsertSqlAndArgs,
  getUpsertSqlAndArgs,
  getAuthHeader,
} from './crate/util.js'
import _debug from 'debug'
import retry from 'p-retry'

const debug = _debug('mongo2crate')

export interface CrateConfig {
  sqlEndpoint?: string
  auth?: string
}

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

export interface QueryOptions {
  args?: any[]
  coltypes?: boolean
}

const defaultConfig = { sqlEndpoint: 'http://localhost:4200/_sql' }

export const crate = (config?: CrateConfig) => {
  const { sqlEndpoint, auth } = _.defaults(defaultConfig, config)
  const authHeader = auth && getAuthHeader(auth)
  debug('Auth header %O', authHeader)

  const query = (sql: string, options?: QueryOptions) => {
    const { args, coltypes = false } = options || {}
    debug('query - sql %s args %O', sql, args)
    return retry(() =>
      fetch(maybeShowColTypes(sqlEndpoint, coltypes), {
        method: 'post',
        body: JSON.stringify({ stmt: sql, ...(args && { args }) }),
        headers: { 'Content-Type': 'application/json', ...authHeader },
      }).then((res) => res.json() as Promise<QueryResult | ErrorResult>)
    )
  }

  const insert = (qualifiedName: string, record: object) => {
    const { sql, args } = getInsertSqlAndArgs(qualifiedName, record)
    return query(sql, { args })
  }

  const upsert = (qualifiedName: string, record: object, update: object) => {
    const { sql, args } = getUpsertSqlAndArgs(qualifiedName, record, update)
    return query(sql, { args })
  }

  const deleteById = (qualifiedName: string, id: string) => {
    const { sql, args } = getDeleteByIdSqlAndArgs(qualifiedName, id)
    return query(sql, { args })
  }

  const bulkInsert = (qualifiedName: string, records: object[]) => {
    const { sql, args } = getBulkInsertSqlAndArgs(qualifiedName, records)
    debug('bulkInsert - sql %s bulk_args %O', sql, args)
    return retry(() =>
      fetch(sqlEndpoint, {
        method: 'post',
        body: JSON.stringify({ stmt: sql, bulk_args: args }),
        headers: { 'Content-Type': 'application/json', ...authHeader },
      }).then((res) => res.json() as Promise<BulkQueryResult | ErrorResult>)
    )
  }

  return { query, insert, upsert, bulkInsert, deleteById }
}

export type Crate = ReturnType<typeof crate>
