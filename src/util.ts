import { Document } from 'mongodb'
import _ from 'lodash/fp.js'

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

export const renameKey = (
  obj: Record<string, any>,
  key: string,
  newKey: string
) => _.flow(_.set(newKey, _.get(key, obj)), _.omit([key]))(obj)

export const setDefaults = (keys: string[], val: any) => {
  const obj: Record<string, any> = {}
  for (const key of keys) {
    obj[key] = val
  }
  return obj
}

export const renameId = (doc: Document): Document =>
  doc._id ? renameKey(doc, '_id', 'id') : doc

export const sumByRowcount = (num: number) =>
  _.sumBy(({ rowcount }) => (rowcount === num ? 1 : 0))
