import { expect, test } from 'claude-code/testing'

import type * as Core from '../hooks/core/index'
import type * as State from '../types'

// types/index.d.ts must stay self-contained, so it repeats these core shapes.
// [A] extends [B] would accept a dropped readonly; this form does not.
// tsc does the check (bun run typecheck); the expect below only uses the values.
type Same<A, B> =
  (<T>(value: T) => T extends A ? 1 : 2) extends <T>(
    value: T,
  ) => T extends B ? 1 : 2
    ? true
    : false

test('the plugin state holds the same shapes core works with', () => {
  const blocker: Same<State.Blocker, Core.Blocker> = true
  const mode: Same<State.Mode, Core.Mode> = true
  const decision: Same<State.Decision, Core.Decision> = true
  const secrets: Same<State.SecretsMode, Core.SecretsMode> = true
  const request: Same<State.HtlRequest, Core.HtlRequest> = true
  const task: Same<State.HtlTask, Core.HtlTask> = true
  const closed: Same<State.ClosedTask, Core.ClosedTask> = true
  expect([blocker, mode, decision, secrets, request, task, closed]).toEqual([
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ])
})
