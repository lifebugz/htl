import { unreachable } from './guards'
import type {
  ClosedTask,
  HtlRequest,
  HtlTask,
  SecretsMode,
  Terms,
} from './types'

export const MAX_OPEN = 3
const NOT_ASSIGNED = 'Not assigned.'
const ONE_PASSWORD_EVIDENCE = /\bop\b|op:\/\/|1password/i
const OP_PLACEHOLDER = /op:\/\/\S*</

export interface SessionTasks {
  readonly open: readonly HtlTask[]
  readonly closed: readonly ClosedTask[]
  readonly secrets: SecretsMode
}

type Refused = ClosedTask & { readonly decision: 'reject' | 'handback' }

function isRefused(task: ClosedTask): task is Refused {
  return task.decision !== 'accept'
}

export function sameTitle(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b)
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function validateRequest(
  request: HtlRequest,
  session: SessionTasks,
  terms: Terms,
): string | undefined {
  const refusal = refusalOf(request, session, terms)
  return refusal === undefined ? undefined : `${NOT_ASSIGNED} ${refusal}`
}

function refusalOf(
  request: HtlRequest,
  session: SessionTasks,
  terms: Terms,
): string | undefined {
  if (session.open.length >= MAX_OPEN) {
    return `The user already has ${String(MAX_OPEN)} open tasks. Wait for them.`
  }

  const open = session.open.find(task => sameTitle(task.title, request.title))
  if (open !== undefined) {
    return `Task #${String(open.id)} "${open.title}" is already open. Don't assign it twice; wait for the user.`
  }

  const refused = session.closed
    .filter(isRefused)
    .find(task => sameTitle(task.title, request.title))
  if (refused !== undefined) {
    return repeatRefusal(refused)
  }

  if (request.blocker === 'secret' && OP_PLACEHOLDER.test(request.steps)) {
    return `The steps hold the op://<vault>/<item>/<field> placeholder. Name the real vault, item and field, or leave the op:// suggestion out, then call ${terms.tool} again.`
  }
  if (session.secrets !== '1password' || request.blocker !== 'secret') {
    return undefined
  }
  if (!ONE_PASSWORD_EVIDENCE.test(request.tried)) {
    return 'The 1Password CLI is installed, so check 1Password first. If the secret is there, reference it as `op://…` and run the command with `op run` or `op inject`. Assign a task only if the item is missing: check with `op item get "<item>" --vault "<vault>" > /dev/null`, and say in `tried` what you found. Run the check yourself; don\'t ask the user to.'
  }
  return undefined
}

function repeatRefusal(task: Refused): string {
  const label = `task #${String(task.id)} "${task.title}"`
  switch (task.decision) {
    case 'reject':
      return `The user already rejected ${label}. Don't assign it again. Find another way, or tell the user what stays blocked.`
    case 'handback':
      return `The user already said you can do ${label} yourself. Do it with your own tools; don't assign it again.`
    default:
      return unreachable(task.decision)
  }
}
