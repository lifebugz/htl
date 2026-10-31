import type { PromptOrigin } from 'claude-code'

import type { Origin, Terms } from './tasks'

export const TOOL = 'mcp__htl__assign_task'

export const TERMS: Terms = {
  tool: TOOL,
  agent: 'Claude',
  command: '/htl',
  askTool: 'AskUserQuestion',
  host: 'Claude Code',
  shellPrefix: '!',
  remote: 'Remote Control',
}

export const FOCUS_HINT = 'ctrl+x tab to use'

export const ENVELOPE: ReadonlySet<string> = new Set([
  'tool',
  'tool_use_id',
  'agentId',
  'requestMeta',
  'consent',
])

const USER_KINDS: readonly PromptOrigin['kind'][] = ['composer', 'sdk']
const REMOTE_KINDS: readonly PromptOrigin['kind'][] = ['bridge', 'slack-ping']

// A kind a newer Claude Code adds falls through to automation, which lifts
// no gate and answers no task.
export function originOf(kind: PromptOrigin['kind']): Origin {
  if (USER_KINDS.includes(kind)) {
    return 'user'
  }
  if (REMOTE_KINDS.includes(kind)) {
    return 'remote'
  }
  return 'automation'
}
