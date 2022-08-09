import _ from 'lodash/fp.js'

export const renameKey = (
  obj: Record<string, any>,
  key: string,
  newKey: string
) => _.flow(_.set(newKey, _.get(key, obj)), _.omit([key]))(obj)
