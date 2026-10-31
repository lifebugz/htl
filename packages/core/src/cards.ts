import type { HtlTask } from './types'

export function cardHeader(
  task: HtlTask,
  position: number,
  total: number,
  hint?: string,
): string {
  const parts = [
    `#${String(task.id)}`,
    task.mode.toUpperCase(),
    `${String(position)} of ${String(total)}`,
  ]
  if (hint !== undefined) {
    parts.push(hint)
  }
  return parts.join(' · ')
}
