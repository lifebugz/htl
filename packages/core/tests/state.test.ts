import { describe, expect, test } from 'bun:test'

import {
  armedTask,
  closedAfterCommit,
  closedAfterRollback,
  MAX_CLOSED,
  newTask,
  openAfterCommit,
  openAfterLift,
  openAfterRollback,
} from '../src/state'
import type { ClosedTask, HtlTask } from '../src/types'
import { LOGIN, task } from './helpers'

const parallel = (id: number): HtlTask =>
  task(id, { ...LOGIN, mode: 'parallel' })

const states = (open: readonly HtlTask[]): [number, boolean][] =>
  open.map(one => [one.id, one.isArmed])

describe('a new task', () => {
  test('a now task starts armed, a parallel one does not', () => {
    expect(newTask(LOGIN, 4)).toEqual({ ...LOGIN, id: 4, isArmed: true })
    expect(newTask({ ...LOGIN, mode: 'parallel' }, 5).isArmed).toBe(false)
  })
})

describe('the gate', () => {
  test('armedTask finds the first armed task', () => {
    expect(armedTask([parallel(1), task(2), task(3)])?.id).toBe(2)
    expect(armedTask([parallel(1)])).toBeUndefined()
  })

  test('a lift disarms every task, in a new list', () => {
    const open = [task(1), parallel(2)]
    const after = openAfterLift(open)
    expect(states(after)).toEqual([
      [1, false],
      [2, false],
    ])
    expect(after).not.toBe(open)
    expect(states(open)).toEqual([
      [1, true],
      [2, false],
    ])
  })
})

describe('committing an answer', () => {
  test('removes the task, lifts the gate, and lists what was armed', () => {
    const { open, armed } = openAfterCommit([task(1), parallel(2), task(3)], 1)
    expect(states(open)).toEqual([
      [2, false],
      [3, false],
    ])
    expect(armed).toEqual([1, 3])
  })

  test('the closed list keeps only the last answers', () => {
    const closed: ClosedTask[] = Array.from({ length: MAX_CLOSED }, (_, i) => ({
      id: i + 1,
      title: `job ${String(i + 1)}`,
      decision: 'accept',
    }))
    const after = closedAfterCommit(closed, task(101), 'reject')
    expect(after).toHaveLength(MAX_CLOSED)
    expect(after[0]?.id).toBe(2)
    expect(after.at(-1)).toEqual({
      id: 101,
      title: LOGIN.title,
      decision: 'reject',
    })
  })
})

describe('rolling back an answer that was not sent', () => {
  test('puts the task back in id order, unarmed', () => {
    const open = openAfterRollback(
      [parallel(1), parallel(3)],
      task(2),
      [],
      false,
    )
    expect(states(open)).toEqual([
      [1, false],
      [2, false],
      [3, false],
    ])
  })

  test('re-arms what the commit lifted, unless a newer lift ran', () => {
    const open = [{ ...task(1), isArmed: false }, parallel(3)]
    expect(states(openAfterRollback(open, task(2), [1, 2], true))).toEqual([
      [1, true],
      [2, true],
      [3, false],
    ])
    expect(states(openAfterRollback(open, task(2), [1, 2], false))).toEqual([
      [1, false],
      [2, false],
      [3, false],
    ])
  })

  test('a task that is already back keeps its entry, and is not added twice', () => {
    const open = [parallel(1), task(2)]
    const committed = { ...task(2), title: 'the committed copy' }
    const after = openAfterRollback(open, committed, [], false)
    expect(after).toEqual(open)
    expect(after).not.toBe(open)
  })

  test('the closed entry goes', () => {
    const closed: ClosedTask[] = [
      { id: 1, title: 'a', decision: 'reject' },
      { id: 2, title: 'b', decision: 'accept' },
    ]
    expect(closedAfterRollback(closed, 1)).toEqual([
      { id: 2, title: 'b', decision: 'accept' },
    ])
  })
})
