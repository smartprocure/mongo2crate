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

export const renameKey = (doc: Document, key: string, newKey: string) => {
  const temp = doc[key]
  delete doc[key]
  doc[newKey] = temp
}

/**
 * Rename keys, mutating the given object.
 */
export const renameKeys = (doc: Document, keys: Record<string, string>) => {
  for (const key in keys) {
    if (key in doc) {
      const newKey = keys[key]
      renameKey(doc, key, newKey)
    }
  }
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
