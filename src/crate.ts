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

import 'dotenv/config'; // Automatically loads environment variables from a .env file

const debug = _debug('mongo2crate:crate')

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

const defaultConfig = { 
  sqlEndpoint: process.env.SQL_ENDPOINT || 'http://localhost:4200/_sql', 
  auth: process.env.AUTH
};


/**
 * Sends a request to the CrateDB.
 * @param {CrateConfig} config - Crate DB configuration.
 * @param {string} endpoint - The endpoint to send the request to.
 * @param {object} body - The request body.
 * @return {Promise<QueryResult | BulkQueryResult | ErrorResult>} The response from the CrateDB.
 */
const crateRequest = _.curry((config: CrateConfig, endpoint: string, body: object) => {
  const { sqlEndpoint, auth } = _.defaults(defaultConfig, config)
  const authHeader = auth && getAuthHeader(auth)
  debug('Auth header %O', authHeader)

  return retry(() =>
    fetch(endpoint, {
      method: 'post',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...authHeader },
    }).then((res) => res.json() as Promise<QueryResult | BulkQueryResult | ErrorResult>)
  )
})

/**
 * Initializes and returns a set of functions to interact with CrateDB.
 * @param {CrateConfig?} config - Optional configuration for the Crate DB client.
 * @return {object} Set of functions to interact with CrateDB.
 */
export const crate = (config?: CrateConfig) => {
  const request = crateRequest(config)

  /**
   * Sends a query to the CrateDB.
   * @param {string} sql - The SQL query string.
   * @param {QueryOptions?} options - Optional query options.
   * @return {Promise<QueryResult | ErrorResult>} The response from the CrateDB.
   */
  const query = (sql: string, options?: QueryOptions) => {
    const { args, coltypes = false } = options || {}
    debug('query - sql %s args %O', sql, args)

    return request(maybeShowColTypes(config.sqlEndpoint, coltypes), {
      stmt: sql, ...(args && { args })
    })
  }

    /**
   * Inserts a record into the CrateDB.
   * @param {string} qualifiedName - The full table name in the CrateDB.
   * @param {object} record - The record to insert.
   * @return {Promise<QueryResult | ErrorResult>} The response from the CrateDB.
   */
  const insert = (qualifiedName: string, record: object) => {
    const { sql, args } = getInsertSqlAndArgs(qualifiedName, record)
    return query(sql, { args })
  }

    /**
   * Inserts or updates a record in the CrateDB.
   * @param {string} qualifiedName - The full table name in the CrateDB.
   * @param {object} record - The record to upsert.
   * @param {object} update - The values to update.
   * @return {Promise<QueryResult | ErrorResult>} The response from the CrateDB.
   */
  const upsert = (qualifiedName: string, record: object, update: object) => {
    const { sql, args } = getUpsertSqlAndArgs(qualifiedName, record, update)
    return query(sql, { args })
  }

    /**
   * Deletes a record by its ID in the CrateDB.
   * @param {string} qualifiedName - The full table name in the CrateDB.
   * @param {string} id - The ID of the record to delete.
   * @return {Promise<QueryResult | ErrorResult>} The response from the CrateDB.
   */
  const deleteById = (qualifiedName: string, id: string) => {
    const { sql, args } = getDeleteByIdSqlAndArgs(qualifiedName, id)
    return query(sql, { args })
  }

   /**
   * Inserts multiple records into the CrateDB.
   * @param {string} qualifiedName - The full table name in the CrateDB.
   * @param {object[]} records - The records to insert.
   * @return {Promise<BulkQueryResult | ErrorResult>} The response from the CrateDB.
   */
  const bulkInsert = (qualifiedName: string, records: object[]) => {
    const { sql, args } = getBulkInsertSqlAndArgs(qualifiedName, records)
    debug('bulkInsert - sql %s bulk_args %O', sql, args)
    return request(config.sqlEndpoint, {
      stmt: sql, bulk_args: args
    })
  }

  return { query, insert, upsert, bulkInsert, deleteById }
}

export type Crate = ReturnType<typeof crate>
