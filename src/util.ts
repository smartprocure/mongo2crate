import _ from 'lodash/fp.js'
import {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  type Document,
} from 'mongodb'

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

/**
 * Get the document ids that failed to be written during a bulk
 * query.
 */
export const getFailedRecords = (
  results: BulkQueryResult['results'],
  documents: ChangeStreamInsertDocument[]
) => {
  const failed: unknown[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.rowcount === -2) {
      failed.push(documents[i].documentKey._id)
    }
  }
  return failed
}

export const partitionEvents = (docs: ChangeStreamDocument[]) => {
  const groups = []
  let subGroup = []
  let previousOperationType: ChangeStreamDocument['operationType'] | undefined =
    undefined

  for (const doc of docs) {
    const operationType = doc.operationType
    if (operationType !== 'insert' || previousOperationType !== operationType) {
      if (subGroup.length) {
        groups.push(subGroup)
      }
      subGroup = []
    }
    subGroup.push(doc)
    previousOperationType = operationType
  }
  if (subGroup.length) {
    groups.push(subGroup)
  }
  return groups
}
