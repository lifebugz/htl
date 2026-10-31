import type { HtlRequest, HtlTask, Terms } from '../src/types'

export const LOGIN: HtlRequest = {
  title: 'Log in to the GitHub CLI',
  steps: 'Run `! gh auth login` and finish the browser login.',
  blocker: 'login',
  why: 'The login needs a browser and a 2FA code.',
  tried: 'Ran `gh auth status`: not logged in.',
  mode: 'now',
}

export const SECRET: HtlRequest = {
  title: 'Create the Twilio auth token',
  steps:
    'Create a token in the Twilio console and save it in 1Password as `op://Private/Twilio/auth token`.',
  blocker: 'secret',
  why: 'The token does not exist yet.',
  tried:
    'Ran `op item get "Twilio" --vault "Private" > /dev/null`: no such item.',
  mode: 'now',
}

export const task = (id: number, request: HtlRequest = LOGIN): HtlTask => ({
  ...request,
  id,
  isArmed: request.mode === 'now',
})

export const EMPTY = { open: [], closed: [], secrets: '1password' } as const

export const without = (field: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(LOGIN).filter(([key]) => key !== field))

export const NO_ENVELOPE: ReadonlySet<string> = new Set()

export const OTHER: Terms = {
  tool: 'assign_task',
  agent: 'the agent',
  command: '/tasks',
  askTool: 'ask_question',
  host: 'the host',
  shellPrefix: '$',
  remote: 'a remote client',
}
