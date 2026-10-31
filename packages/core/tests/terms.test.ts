import { describe, expect, test } from 'bun:test'

import { cardHeader } from '../src/cards'
import {
  answeringText,
  assignedText,
  assignedToast,
  contextLine,
  decisionLabel,
  decisionPrompt,
  decisionToast,
  gateDenial,
  htlUsage,
  notOpenText,
  notSentToast,
  notYours,
  refusalText,
  reminderLine,
  statusLine,
  statusText,
  SUBAGENT_REFUSAL,
  taskListText,
} from '../src/text'
import { inputSchema, toolDescription } from '../src/tool'
import type { Decision } from '../src/types'
import { validateRequest } from '../src/validate'
import { EMPTY, OTHER, SECRET, task } from './helpers'

const DECISIONS: readonly Decision[] = ['accept', 'reject', 'handback']
const CLAUDE_CODE = /mcp__|AskUserQuestion|Claude|Remote Control|ctrl\+x|\/htl/
const PLACEHOLDER = {
  ...SECRET,
  steps: 'Save it as `op://<vault>/<item>/<field>`.',
}

describe('terms', () => {
  test('with other terms, no text names Claude Code', () => {
    const one = task(1)
    const texts = [
      toolDescription('1password', OTHER),
      toolDescription('none', OTHER),
      JSON.stringify(inputSchema('1password', OTHER)),
      JSON.stringify(inputSchema('none', OTHER)),
      validateRequest(PLACEHOLDER, EMPTY, OTHER) ?? '',
      refusalText(['title is missing'], OTHER),
      reminderLine([one], OTHER),
      statusLine(2, OTHER),
      statusText(false, 1, OTHER) ?? '',
      assignedToast(one, OTHER),
      notSentToast(one, OTHER),
      htlUsage(OTHER),
      notYours(OTHER),
      taskListText([one], OTHER),
      assignedText(one),
      gateDenial(one),
      contextLine([one]),
      notOpenText(2, [one]),
      SUBAGENT_REFUSAL,
      cardHeader(one, 1, 1),
      ...DECISIONS.flatMap(decision => [
        decisionToast(one, decision, OTHER),
        answeringText(one, decision, OTHER),
        decisionPrompt(one, decision, 'done'),
        decisionLabel(decision),
      ]),
    ]
    for (const text of texts) {
      expect(text).not.toMatch(CLAUDE_CODE)
    }
  })

  test('each harness word comes from the terms', () => {
    expect(refusalText(['title is missing'], OTHER)).toContain(
      'call assign_task again',
    )
    expect(validateRequest(PLACEHOLDER, EMPTY, OTHER)).toContain(
      'call assign_task again',
    )
    expect(toolDescription('none', OTHER)).toContain('use ask_question.')
    expect(JSON.stringify(inputSchema('none', OTHER))).toContain(
      'gets a $ prefix, so they can paste it into the host: `$ gh auth login`.',
    )
    expect(assignedToast(task(1), OTHER)).toBe(
      'htl: the agent needs you for task #1 "Log in to the GitHub CLI"',
    )
    expect(decisionToast(task(1), 'handback', OTHER)).toBe(
      'htl: task #1 handed back to the agent',
    )
    expect(statusLine(1, OTHER)).toBe('1 task waiting for you · /tasks')
    expect(htlUsage(OTHER)).toContain('/tasks accept, /tasks reject')
    expect(notYours(OTHER)).toContain('through a remote client.')
  })
})
