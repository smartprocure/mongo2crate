import _debug from 'debug'
import _ from 'lodash/fp.js'
import fetch from 'node-fetch'

import {
  getAuthHeader,
  getBulkInsertSqlAndArgs,
  getDeleteByIdSqlAndArgs,
  getInsertSqlAndArgs,
  getUpsertSqlAndArgs,
  maybeShowColTypes,
} from './crate/util.js'

const debug = _debug('mongo2crate:crate')
debug.log = console.log.bind(console)

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

export type Response = QueryResult | ErrorResult
export type BulkResponse = BulkQueryResult | ErrorResult

export interface QueryOptions {
  args?: any[]
  coltypes?: boolean
}

const defaultConfig = { sqlEndpoint: 'http://localhost:4200/_sql' }

export const crate = (config?: CrateConfig) => {
  const { sqlEndpoint, auth } = _.defaults(defaultConfig, config)
  const authHeader = auth && getAuthHeader(auth)
  debug('Auth header %O', authHeader)

  const query = async (sql: string, options?: QueryOptions) => {
    const { args, coltypes = false } = options || {}
    debug('SQL endpoint - %s', sqlEndpoint)
    debug('query - sql %s args %O', sql, args)
    const body = JSON.stringify({ stmt: sql, ...(args && { args }) })
    const headers = { 'Content-Type': 'application/json', ...authHeader }
    debug('headers - %o', headers)
    const resp = await fetch(maybeShowColTypes(sqlEndpoint, coltypes), {
      method: 'post',
      body,
      headers,
    })
    return (await resp.json()) as Response
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
    return fetch(sqlEndpoint, {
      method: 'post',
      body: JSON.stringify({ stmt: sql, bulk_args: args }),
      headers: { 'Content-Type': 'application/json', ...authHeader },
    }).then((res) => res.json() as Promise<BulkResponse>)
  }

  return { query, insert, upsert, bulkInsert, deleteById }
}

export type Crate = ReturnType<typeof crate>
