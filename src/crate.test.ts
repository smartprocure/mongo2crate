import { describe, expect, it } from 'vitest'

import {
  getAssignmentsAndUpdates,
  getBulkInsertSqlAndArgs,
  getUniqueKeys,
  quoteColumn,
} from './crate/util.js'

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
    expect(getBulkInsertSqlAndArgs('"doc"."foo"', records)).toEqual({
      sql: 'INSERT INTO "doc"."foo" ("a","b","c","d") VALUES (?,?,?,?)',
      args: [
        [1, 2, null, null],
        [null, 5, 3, null],
        [27, 7, null, 12],
      ],
    })
  })
})
describe('quoteColumn', () => {
  it('should quote unnested column', () => {
    const col = 'foo'
    expect(quoteColumn(col)).toBe('"foo"')
  })
  it('should quote nested column', () => {
    const col = 'foo.bar.baz'
    expect(quoteColumn(col)).toBe(`"foo"['bar']['baz']`)
  })
})
describe('getAssignments', () => {
  it('should handle numeric nested path', () => {
    const record = { foo: [{ bar: false }] }
    const update = { 'foo.0.bar': false }
    expect(getAssignmentsAndUpdates(record, update)).toEqual({
      assignments: '"foo" = ?',
      updates: [[{ bar: false }]],
    })
  })
  it('should handle non-numeric nested path', () => {
    const record = { foo: { bar: { baz: false } } }
    const update = { 'foo.bar.baz': false }
    expect(getAssignmentsAndUpdates(record, update)).toEqual({
      assignments: `"foo"['bar']['baz'] = ?`,
      updates: [false],
    })
  })
  it('should handle a mixture of numeric and non-numeric nested paths', () => {
    const record = { foo: [{ bar: false }], address: { state: 'CA' } }
    const update = { 'foo.0.bar': false, 'address.state': 'CA' }
    expect(getAssignmentsAndUpdates(record, update)).toEqual({
      assignments: `"foo" = ?,"address"['state'] = ?`,
      updates: [[{ bar: false }], 'CA'],
    })
  })
})
