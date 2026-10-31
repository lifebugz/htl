import { describe, expect, test } from 'bun:test'

import { parseRequest } from '../src/request'
import { LOGIN, NO_ENVELOPE, without } from './helpers'

describe('parseRequest', () => {
  test('a full request parses, trimmed, with and without check', () => {
    expect(
      parseRequest({ ...LOGIN, title: '  Log in  ' }, NO_ENVELOPE),
    ).toEqual({
      request: { ...LOGIN, title: 'Log in' },
    })
    expect(
      parseRequest({ ...LOGIN, check: ' gh auth status ' }, NO_ENVELOPE),
    ).toEqual({
      request: { ...LOGIN, check: 'gh auth status' },
    })
  })

  for (const field of ['title', 'steps', 'why', 'tried'] as const) {
    test(`${field}: missing, blank and not a string are refused`, () => {
      expect(parseRequest(without(field), NO_ENVELOPE).problems).toEqual([
        `${field} is missing`,
      ])
      expect(
        parseRequest({ ...LOGIN, [field]: '   ' }, NO_ENVELOPE).problems,
      ).toEqual([`${field} is empty`])
      expect(
        parseRequest({ ...LOGIN, [field]: 7 }, NO_ENVELOPE).problems,
      ).toEqual([`${field} must be a string`])
    })
  }

  test('blocker and mode take only their listed values', () => {
    expect(
      parseRequest({ ...LOGIN, blocker: 'hard' }, NO_ENVELOPE).problems,
    ).toEqual([
      'blocker must be one of: secret, login, physical, payment_or_legal, no_access',
    ])
    expect(
      parseRequest({ ...LOGIN, mode: 'later' }, NO_ENVELOPE).problems,
    ).toEqual(['mode must be one of: now, parallel'])
    expect(parseRequest(without('mode'), NO_ENVELOPE).problems).toEqual([
      'mode is missing',
    ])
  })

  test('check must be a string; a blank check is left out', () => {
    expect(parseRequest({ ...LOGIN, check: 3 }, NO_ENVELOPE).problems).toEqual([
      'check must be a string',
    ])
    expect(parseRequest({ ...LOGIN, check: '  ' }, NO_ENVELOPE)).toEqual({
      request: LOGIN,
    })
  })

  test('extra fields are refused, and every problem is listed', () => {
    expect(
      parseRequest({ ...LOGIN, urgency: 'high' }, NO_ENVELOPE).problems,
    ).toEqual(['unknown fields: urgency'])
    expect(
      parseRequest({ title: '', mode: 'soon', x: 1 }, NO_ENVELOPE).problems,
    ).toEqual([
      'title is empty',
      'steps is missing',
      'blocker is missing',
      'why is missing',
      'tried is missing',
      'mode must be one of: now, parallel',
      'unknown fields: x',
    ])
  })

  test('an input that is not an object is refused', () => {
    expect(parseRequest(null, NO_ENVELOPE).problems).toEqual([
      'the input must be an object',
    ])
    expect(parseRequest(['x'], NO_ENVELOPE).problems).toEqual([
      'the input must be an object',
    ])
  })
})
