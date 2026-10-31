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

export function cardIndex(
  open: readonly HtlTask[],
  taskId: number | null,
): number {
  return Math.max(
    0,
    open.findIndex(task => task.id === taskId),
  )
}

export function nextTaskId(
  open: readonly HtlTask[],
  taskId: number,
): number | null {
  const at = open.findIndex(task => task.id === taskId)
  const following = open[(at + 1) % open.length] ?? open[0]
  return following?.id ?? null
}
