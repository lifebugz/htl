import { describe, expect, test } from 'bun:test'

import { cardHeader, cardIndex, nextTaskId } from '../src/cards'
import { LOGIN, task } from './helpers'

const open = [task(1), task(4), task(7)]

describe('cards', () => {
  test('cardIndex finds the shown task, else the first card', () => {
    expect(cardIndex(open, 4)).toBe(1)
    expect(cardIndex(open, null)).toBe(0)
    expect(cardIndex(open, 9)).toBe(0)
  })

  test('nextTaskId moves to the next card and wraps around', () => {
    expect(nextTaskId(open, 1)).toBe(4)
    expect(nextTaskId(open, 7)).toBe(1)
    expect(nextTaskId(open, 9)).toBe(1)
    expect(nextTaskId([], 1)).toBeNull()
  })

  test('the header shows a hint only when given one', () => {
    expect(cardHeader(task(1), 1, 3)).toBe('#1 · NOW · 1 of 3')
    expect(
      cardHeader(task(2, { ...LOGIN, mode: 'parallel' }), 2, 3, 'tab to use'),
    ).toBe('#2 · PARALLEL · 2 of 3 · tab to use')
  })
})
