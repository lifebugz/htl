import { describe, expect, test } from 'bun:test'

import { assignedText, decisionPrompt } from '../src/text'
import { LOGIN, task } from './helpers'

describe('texts Claude reads', () => {
  test('the now and parallel results', () => {
    expect(assignedText(task(1))).toBe(
      'Assigned as task #1 (now). End your turn now with one short line saying what you are waiting for. Other tool calls are refused until the user answers; the answer arrives as the next user message.',
    )
    expect(assignedText(task(2, { ...LOGIN, mode: 'parallel' }))).toBe(
      "Assigned as task #2 (parallel). Keep working only on what does not depend on it. Don't do it yourself, don't assume it's done. When that work is done, end your turn and say you are waiting for task #2.",
    )
  })

  describe('decisionPrompt', () => {
    const checked = task(1, { ...LOGIN, check: 'gh auth status' })

    test('accept, with a check and a message', () => {
      expect(decisionPrompt(checked, 'accept', '  used my work account ')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": accepted, I did it.\nMy message: used my work account\nCheck it worked (run `gh auth status` or re-run what failed), then continue.',
      )
    })

    test('accept, with no check and no message', () => {
      expect(decisionPrompt(task(1), 'accept', '   ')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": accepted, I did it.\nCheck it worked (re-run what failed), then continue.',
      )
    })

    test('reject, with and without a message', () => {
      expect(decisionPrompt(checked, 'reject', 'not today')).toBe(
        "HTL task #1 \"Log in to the GitHub CLI\": rejected, I won't do it.\nMy message: not today\nDon't assume it's done. Find another way, or tell me what stays blocked.",
      )
      expect(decisionPrompt(checked, 'reject', '')).toBe(
        "HTL task #1 \"Log in to the GitHub CLI\": rejected, I won't do it.\nDon't assume it's done. Find another way, or tell me what stays blocked.",
      )
    })

    test('you can do this, with and without a message', () => {
      expect(decisionPrompt(checked, 'handback', 'use the token in CI')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": you can do this yourself.\nMy message: use the token in CI\nDo it with your own tools. Don\'t assign it to me again.',
      )
      expect(decisionPrompt(checked, 'handback', '')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": you can do this yourself.\nDo it with your own tools. Don\'t assign it to me again.',
      )
    })
  })
})
