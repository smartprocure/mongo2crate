import { Document } from 'mongodb'
import _ from 'lodash/fp.js'

export const omitFields = (omitPaths: string[]) =>
  _.flow(
    _.omit(omitPaths),
    // Handle nested field updates
    _.omitBy((val, key) =>
      _.find((omitPath) => _.startsWith(`${omitPath}.`, key), omitPaths)
    )
  )

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

export const defaultDocMapper = (doc: Document) =>
  doc._id ? renameKey(doc, '_id', 'id') : doc
