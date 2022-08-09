import _ from 'lodash/fp.js'

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
