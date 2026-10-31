// GENERATED from packages/core - edit there, run `bun run core:sync`
import type { ClosedTask, Decision, HtlRequest, HtlTask } from './types'

export const MAX_CLOSED = 100

export function newTask(request: HtlRequest, id: number): HtlTask {
  return {
    ...request,
    id,
    isArmed: request.mode === 'now',
  }
}

function lifted(task: HtlTask): HtlTask {
  return task.isArmed ? { ...task, isArmed: false } : task
}

export function armedTask(open: readonly HtlTask[]): HtlTask | undefined {
  return open.find(task => task.isArmed)
}

export function openAfterLift(open: readonly HtlTask[]): HtlTask[] {
  return open.map(lifted)
}

export function openAfterCommit(
  open: readonly HtlTask[],
  taskId: number,
): { open: HtlTask[]; armed: number[] } {
  return {
    open: open.filter(one => one.id !== taskId).map(lifted),
    armed: open.filter(one => one.isArmed).map(one => one.id),
  }
}

export function closedAfterCommit(
  closed: readonly ClosedTask[],
  task: HtlTask,
  decision: Decision,
): ClosedTask[] {
  return [...closed, { id: task.id, title: task.title, decision }].slice(
    -MAX_CLOSED,
  )
}

export function openAfterRollback(
  open: readonly HtlTask[],
  task: HtlTask,
  armed: readonly number[],
  reArm: boolean,
): HtlTask[] {
  const back = open.some(one => one.id === task.id)
    ? [...open]
    : [
        ...open.filter(one => one.id < task.id),
        { ...task, isArmed: false },
        ...open.filter(one => one.id > task.id),
      ]
  if (!reArm) {
    return back
  }
  return back.map(one =>
    armed.includes(one.id) ? { ...one, isArmed: true } : one,
  )
}

export function closedAfterRollback(
  closed: readonly ClosedTask[],
  taskId: number,
): ClosedTask[] {
  return closed.filter(one => one.id !== taskId)
}
