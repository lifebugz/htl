import { describe, expect, test } from 'bun:test'

import { parseHtlArgs } from '../src/command'

describe('/htl arguments', () => {
  test('no arguments opens the pane', () => {
    expect(parseHtlArgs('')).toEqual({ kind: 'open' })
    expect(parseHtlArgs('   ')).toEqual({ kind: 'open' })
  })

  test('a decision, a task number with or without #, and the rest as the message', () => {
    expect(parseHtlArgs(' ACCEPT #3 ')).toEqual({
      kind: 'answer',
      decision: 'accept',
      taskId: 3,
      message: '',
    })
    expect(parseHtlArgs('handback 12 use the token\nin CI ')).toEqual({
      kind: 'answer',
      decision: 'handback',
      taskId: 12,
      message: 'use the token\nin CI',
    })
  })

  test('anything else is usage', () => {
    for (const args of [
      'accept',
      'accept one',
      'yes 1',
      '1 accept',
      'reject #',
    ]) {
      expect(parseHtlArgs(args)).toEqual({ kind: 'usage' })
    }
  })
})
