// GENERATED from packages/core - edit there, run `bun run core:sync`
import { isOneOf } from './guards'
import type { Decision } from './types'

const DECISIONS: readonly Decision[] = ['accept', 'reject', 'handback']

export type HtlCommand =
  | { readonly kind: 'open' }
  | { readonly kind: 'usage' }
  | {
      readonly kind: 'answer'
      readonly decision: Decision
      readonly taskId: number
      readonly message: string
    }

const ANSWER_ARGS = /^(\S+)\s+#?(\d+)(?:\s+([\s\S]*))?$/

export function parseHtlArgs(args: string): HtlCommand {
  const trimmed = args.trim()
  if (trimmed === '') {
    return { kind: 'open' }
  }
  const match = ANSWER_ARGS.exec(trimmed)
  const decision = match?.[1]?.toLowerCase()
  const id = match?.[2]
  if (decision === undefined || id === undefined) {
    return { kind: 'usage' }
  }
  if (!isOneOf(DECISIONS, decision)) {
    return { kind: 'usage' }
  }
  return {
    kind: 'answer',
    decision,
    taskId: Number(id),
    message: (match?.[3] ?? '').trim(),
  }
}
