// GENERATED from packages/core - edit there, run `bun run core:sync`
import { unreachable } from './guards'
import type { Blocker, Decision, HtlTask, Terms } from './types'

function quoted(task: { readonly id: number; readonly title: string }): string {
  return `#${String(task.id)} "${task.title}"`
}

export function assignedText(task: HtlTask): string {
  const id = String(task.id)
  switch (task.mode) {
    case 'now':
      return `Assigned as task #${id} (now). End your turn now with one short line saying what you are waiting for. Other tool calls are refused until the user answers; the answer arrives as the next user message.`
    case 'parallel':
      return `Assigned as task #${id} (parallel). Keep working only on what does not depend on it. Don't do it yourself, don't assume it's done. When that work is done, end your turn and say you are waiting for task #${id}.`
    default:
      return unreachable(task.mode)
  }
}

export const SUBAGENT_REFUSAL =
  'Only the main conversation can assign tasks; put the blocker in your final report.'

export function refusalText(problems: readonly string[], terms: Terms): string {
  return `The task was not assigned: ${problems.join('; ')}. Fix these fields and call ${terms.tool} again.`
}

export function gateDenial(task: HtlTask): string {
  return `Waiting for the user to finish HTL task ${quoted(task)}. End your turn now.`
}

export function contextLine(tasks: readonly HtlTask[]): string {
  const listed = tasks.map(task => `${quoted(task)} (${task.mode})`).join(', ')
  return `Open HTL tasks waiting for the user: ${listed}. Don't assume they are done.`
}

function taskList(tasks: readonly HtlTask[]): string {
  const ids = tasks.map(task => `#${String(task.id)}`).join(', ')
  return `${tasks.length === 1 ? 'task' : 'tasks'} ${ids}`
}

export function reminderLine(tasks: readonly HtlTask[], terms: Terms): string {
  return `⏳ htl: waiting for you on ${taskList(tasks)} · ${terms.command}`
}

export function statusLine(count: number, terms: Terms): string {
  return `${String(count)} ${count === 1 ? 'task' : 'tasks'} waiting for you · ${terms.command}`
}

export function assignedToast(task: HtlTask, terms: Terms): string {
  return `htl: ${terms.agent} needs you for task ${quoted(task)}`
}

export function decisionToast(
  task: HtlTask,
  decision: Decision,
  terms: Terms,
): string {
  return `htl: task #${String(task.id)} ${decisionPast(decision, terms)}`
}

export function htlUsage(terms: Terms): string {
  const { command } = terms
  return `Answer a task with ${command} accept, ${command} reject or ${command} handback ("you can do this") and its number, then an optional message: ${command} accept 1 done with my work account.`
}

export function taskListText(tasks: readonly HtlTask[], terms: Terms): string {
  const cards = tasks.map(task =>
    [
      `#${String(task.id)} · ${task.mode.toUpperCase()} · ${task.title}`,
      `${blockerLabel(task.blocker)}: ${task.why}`,
      task.steps,
    ].join('\n'),
  )
  return ['Open HTL tasks:', ...cards, htlUsage(terms)].join('\n\n')
}

export function notYours(terms: Terms): string {
  return `Only you can answer an HTL task: type the command yourself, here or through ${terms.remote}.`
}

export function answeringText(
  task: HtlTask,
  decision: Decision,
  terms: Terms,
): string {
  return `Sending your answer to task ${quoted(task)}: ${decisionPast(decision, terms)}. If ${terms.command} still lists the task, it was not sent.`
}

export function notOpenText(taskId: number, open: readonly HtlTask[]): string {
  if (open.length === 0) {
    return 'No open HTL tasks.'
  }
  const ids = open.map(task => `#${String(task.id)}`).join(', ')
  return `No open task #${String(taskId)}. Open: ${ids}.`
}

export function notSentToast(task: HtlTask, terms: Terms): string {
  return `htl: the answer to task #${String(task.id)} was not sent. Answer again in ${terms.command}.`
}

function decisionPast(decision: Decision, terms: Terms): string {
  switch (decision) {
    case 'accept':
      return 'accepted'
    case 'reject':
      return 'rejected'
    case 'handback':
      return `handed back to ${terms.agent}`
    default:
      return unreachable(decision)
  }
}

export function decisionLabel(decision: Decision): string {
  switch (decision) {
    case 'accept':
      return 'Accept'
    case 'reject':
      return 'Reject'
    case 'handback':
      return 'You can do this'
    default:
      return unreachable(decision)
  }
}

export function decisionPrompt(
  task: HtlTask,
  decision: Decision,
  message: string,
): string {
  const head = `HTL task ${quoted(task)}`
  const note = message.trim() === '' ? [] : [`My message: ${message.trim()}`]
  switch (decision) {
    case 'accept': {
      const how =
        task.check === undefined
          ? 're-run what failed'
          : `run \`${task.check}\` or re-run what failed`
      return [
        `${head}: accepted, I did it.`,
        ...note,
        `Check it worked (${how}), then continue.`,
      ].join('\n')
    }
    case 'reject':
      return [
        `${head}: rejected, I won't do it.`,
        ...note,
        "Don't assume it's done. Find another way, or tell me what stays blocked.",
      ].join('\n')
    case 'handback':
      return [
        `${head}: you can do this yourself.`,
        ...note,
        "Do it with your own tools. Don't assign it to me again.",
      ].join('\n')
    default:
      return unreachable(decision)
  }
}

export function blockerLabel(blocker: Blocker): string {
  switch (blocker) {
    case 'secret':
      return 'secret'
    case 'login':
      return 'login'
    case 'physical':
      return 'physical'
    case 'payment_or_legal':
      return 'payment or legal'
    case 'no_access':
      return 'no access'
    default:
      return unreachable(blocker)
  }
}
