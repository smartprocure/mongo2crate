import { ChangeStreamInsertDocument } from 'mongodb'
import { describe, expect, it } from 'vitest'

import { partitionEvents } from './util'

describe('util', () => {
  describe('partitionEvents', () => {
    it('should group a set of insert events together', () => {
      const events = [
        { operationType: 'insert' },
        { operationType: 'insert' },
        { operationType: 'insert' },
      ] as unknown as ChangeStreamInsertDocument[]
      const result = partitionEvents(events)
      expect(result).toEqual([
        [
          { operationType: 'insert' },
          { operationType: 'insert' },
          { operationType: 'insert' },
        ],
      ])
    })
    it('should partition mixed events', () => {
      const events = [
        { operationType: 'delete' },
        { operationType: 'insert' },
        { operationType: 'insert' },
        { operationType: 'update' },
        { operationType: 'insert' },
        { operationType: 'insert' },
        { operationType: 'update' },
      ] as unknown as ChangeStreamInsertDocument[]
      const result = partitionEvents(events)
      expect(result).toEqual([
        [{ operationType: 'delete' }],
        [{ operationType: 'insert' }, { operationType: 'insert' }],
        [{ operationType: 'update' }],
        [{ operationType: 'insert' }, { operationType: 'insert' }],
        [{ operationType: 'update' }],
      ])
    })
    it('should not group non-insert events', () => {
      const events = [
        { operationType: 'delete' },
        { operationType: 'delete' },
        { operationType: 'update' },
        { operationType: 'update' },
      ] as unknown as ChangeStreamInsertDocument[]
      const result = partitionEvents(events)
      expect(result).toEqual([
        [{ operationType: 'delete' }],
        [{ operationType: 'delete' }],
        [{ operationType: 'update' }],
        [{ operationType: 'update' }],
      ])
    })
  })
})
