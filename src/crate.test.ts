import { getUniqueKeys, getBulkInsertSqlAndArgs } from './crate-utils.js'

describe('getUniqueKeys', () => {
  it('should work', () => {
    const records = [
      { a: 1, b: 2 },
      { c: 3, b: 5 },
      { b: 7, d: 12, a: 27 },
    ]
    expect(getUniqueKeys(records)).toEqual(['a', 'b', 'c', 'd'])
  })
})
describe('getBulkInsertSqlAndArgs', () => {
  it('should work', () => {
    const records = [
      { a: 1, b: 2 },
      { c: 3, b: 5 },
      { b: 7, d: 12, a: 27 },
    ]
    expect(getBulkInsertSqlAndArgs('foo', records)).toEqual({
      sql: 'INSERT INTO doc."foo" ("a","b","c","d") VALUES (?,?,?,?)',
      args: [
        [1, 2, null, null],
        [null, 5, 3, null],
        [27, 7, null, 12],
      ],
    })
  })
})
