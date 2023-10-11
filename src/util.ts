import { Document } from 'mongodb';
import _ from 'lodash/fp.js';

/**
 * Does arr start with startsWith array.
 */
export const arrayStartsWith = (arr: any[], startsWith: any[]): boolean => 
  startsWith.every((value, index) => arr[index] === value);

export const setDefaults = (keys: string[], val: any): Record<string, any> => {
  const obj: Record<string, any> = {};
  for (const key of keys) {
    obj[key] = val;
  }
  return obj;
};

export const renameKey = (doc: Document, key: string, newKey: string): Document => {
  if (!_.has(key, doc)) return doc;
  return _.flow(
    _.set(newKey, _.get(key, doc)),
    _.omit([key])
  )(doc);
};

export const renameKeys = (doc: Document, keys: Record<string, string>): Document => 
  Object.keys(keys).reduce((currentDoc, key) => 
    _.has(key, currentDoc) ? renameKey(currentDoc, key, keys[key]) : currentDoc, 
  doc);

export const sumByRowcount = (num: number) => 
  _.sumBy(({ rowcount }) => (rowcount === num ? 1 : 0));
