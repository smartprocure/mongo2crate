import _ from 'lodash/fp.js'
import { type Document } from 'mongodb'

import { BulkQueryResult } from './crate.js'

/**
 * Does arr start with startsWith array.
 */
export const arrayStartsWith = (arr: any[], startsWith: any[]) => {
  for (let i = 0; i < startsWith.length; i++) {
    if (arr[i] !== startsWith[i]) {
      return false
    }
  }

  return true
}

export const setDefaults = (keys: string[], val: any) => {
  const obj: Record<string, any> = {}
  for (const key of keys) {
    obj[key] = val
  }
  return obj
}

export const renameKey = (doc: Document, key: string, newKey: string) =>
  _.flow(_.set(newKey, _.get(key, doc)), _.omit([key]))(doc)

export const renameKeys = (doc: Document, keys: Record<string, string>) => {
  let newDoc = doc
  for (const key in keys) {
    if (_.has(key, doc)) {
      const newKey = keys[key]
      newDoc = renameKey(newDoc, key, newKey)
    }
  }
  return newDoc
}

export const sumByRowcount = (num: number) =>
  _.sumBy(({ rowcount }) => (rowcount === num ? 1 : 0))

export const getFailedRecords = (
  results: BulkQueryResult['results'],
  documents: Document[]
) => {
  const failed: unknown[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.rowcount === -2) {
      failed.push(documents[i])
    }
  }
  return failed
}
