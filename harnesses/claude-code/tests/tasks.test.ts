import type { PromptOrigin } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import type { HtlRequest, HtlTask } from '../types'
import { ENVELOPE, FOCUS_HINT, TERMS, TOOL, originOf } from '../hooks/host'
import type { Origin } from '../hooks/core/index'
import {
  SUBAGENT_REFUSAL,
  TOOL_NAME,
  answeringText,
  answersTasks,
  assignedToast,
  blockerLabel,
  cardHeader,
  contextLine,
  decisionLabel,
  decisionToast,
  gateDenial,
  htlUsage,
  inputSchema,
  isRemote,
  notOpenText,
  notSentToast,
  notYours,
  parseRequest,
  refusalText,
  reminderLine,
  statusLine,
  taskListText,
  toolDescription,
  validateRequest,
} from '../hooks/core/index'

const LOGIN: HtlRequest = {
  title: 'Log in to the GitHub CLI',
  steps: 'Run `! gh auth login` and finish the browser login.',
  blocker: 'login',
  why: 'The login needs a browser and a 2FA code.',
  tried: 'Ran `gh auth status`: not logged in.',
  mode: 'now',
}

const SECRET: HtlRequest = {
  title: 'Create the Twilio auth token',
  steps:
    'Create a token in the Twilio console and save it in 1Password as `op://Private/Twilio/auth token`.',
  blocker: 'secret',
  why: 'The token does not exist yet.',
  tried:
    'Ran `op item get "Twilio" --vault "Private" > /dev/null`: no such item.',
  mode: 'now',
}

const task = (id: number, request: HtlRequest = LOGIN): HtlTask => ({
  ...request,
  id,
  isArmed: request.mode === 'now',
})

const EMPTY = { open: [], closed: [], secrets: '1password' } as const

const ANSWERS: Readonly<Record<PromptOrigin['kind'], boolean>> = {
  composer: true,
  bridge: true,
  sdk: true,
  'slack-ping': true,
  'task-notification': false,
  'scheduled-trigger': false,
  peer: false,
  'peer-send-message': false,
  'projects-relay': false,
  channel: false,
  coordinator: false,
  observer: false,
  'observer-activity': false,
  'auto-continuation': false,
  unclassified: false,
  plugin: false,
}

const ORIGINS: Readonly<Record<PromptOrigin['kind'], Origin>> = {
  composer: 'user',
  bridge: 'remote',
  sdk: 'user',
  'slack-ping': 'remote',
  'task-notification': 'automation',
  'scheduled-trigger': 'automation',
  peer: 'automation',
  'peer-send-message': 'automation',
  'projects-relay': 'automation',
  channel: 'automation',
  coordinator: 'automation',
  observer: 'automation',
  'observer-activity': 'automation',
  'auto-continuation': 'automation',
  unclassified: 'automation',
  plugin: 'automation',
}

function isKind(value: string): value is PromptOrigin['kind'] {
  return value in ANSWERS
}

describe('parseRequest', () => {
  test('the tool.call envelope fields are not extra fields', () => {
    expect(
      parseRequest(
        {
          ...LOGIN,
          tool: 'mcp__htl__assign_task',
          tool_use_id: 'toolu_1',
          agentId: 'a1',
          requestMeta: {},
          consent: 'yes',
        },
        ENVELOPE,
      ),
    ).toEqual({ request: LOGIN })
  })
})

describe('validateRequest', () => {
  describe('1Password', () => {
    test('the op://<vault>/<item>/<field> placeholder is refused, with or without op', () => {
      const PLACEHOLDER =
        'Not assigned. The steps hold the op://<vault>/<item>/<field> placeholder. Name the real vault, item and field, or leave the op:// suggestion out, then call mcp__htl__assign_task again.'
      const steps = 'Save it as `op://<vault>/<item>/<field>`.'
      expect(validateRequest({ ...SECRET, steps }, EMPTY, TERMS)).toBe(
        PLACEHOLDER,
      )
      expect(
        validateRequest(
          { ...SECRET, steps },
          { ...EMPTY, secrets: 'none' },
          TERMS,
        ),
      ).toBe(PLACEHOLDER)
      expect(
        validateRequest(
          { ...SECRET, steps: 'Save it as `op://Private/<item>/credential`.' },
          EMPTY,
          TERMS,
        ),
      ).toBe(PLACEHOLDER)
    })
  })
})

describe('answersTasks', () => {
  test('only what the user sends lifts the gate', () => {
    expect(
      Object.keys(ANSWERS)
        .filter(isKind)
        .map(kind => [kind, answersTasks(originOf(kind))]),
    ).toEqual(Object.entries(ANSWERS))
  })
})

describe('host', () => {
  test('originOf maps every origin kind Claude Code has', () => {
    expect(
      Object.keys(ORIGINS)
        .filter(isKind)
        .map(kind => [kind, originOf(kind)]),
    ).toEqual(Object.entries(ORIGINS))
  })

  test('the tool name is mcp__, the plugin name, __ and the registered name', () => {
    expect(TOOL).toBe(`mcp__htl__${TOOL_NAME}`)
  })
})

describe('/htl arguments', () => {
  test('only Remote Control and a Slack ping count as remote', () => {
    expect(isRemote(originOf('bridge'))).toBe(true)
    expect(isRemote(originOf('slack-ping'))).toBe(true)
    expect(isRemote(originOf('composer'))).toBe(false)
    expect(isRemote(originOf('sdk'))).toBe(false)
  })
})

describe('the tool description', () => {
  test('holds the 1Password rules only under 1password', () => {
    expect(toolDescription('1password', TERMS)).toContain('op run --env-file=')
    expect(toolDescription('1password', TERMS)).toContain('op inject -i')
    expect(toolDescription('none', TERMS)).not.toContain('1Password')
    expect(toolDescription('none', TERMS)).not.toContain('op://')
  })

  test('the rules leave permissions to Claude Code', () => {
    for (const secrets of ['1password', 'none'] as const) {
      expect(toolDescription(secrets, TERMS)).not.toMatch(
        /auto mode|denied|permission/i,
      )
    }
  })

  test('the rule against asking for or printing a secret holds with or without op', () => {
    const rule = 'Never ask the user for a secret value, and never print one.'
    expect(toolDescription('1password', TERMS)).toContain(rule)
    expect(toolDescription('none', TERMS)).toContain(rule)
  })

  test('both versions fit the 4096 characters the model is sent', () => {
    expect(toolDescription('1password', TERMS).length).toBeLessThanOrEqual(4096)
    expect(toolDescription('none', TERMS).length).toBeLessThanOrEqual(4096)
  })

  test('the steps suggest an op:// reference only under 1password', () => {
    const stepsOf = (schema: Readonly<Record<string, unknown>>): unknown =>
      JSON.stringify(schema['properties'])
    expect(stepsOf(inputSchema('1password', TERMS))).toContain(
      'may suggest a 1Password reference to save it under',
    )
    expect(stepsOf(inputSchema('none', TERMS))).not.toContain('1Password')
  })

  test('the schema requires every field but check, and nothing else', () => {
    const schema = inputSchema('1password', TERMS)
    expect(schema['required']).toEqual([
      'title',
      'steps',
      'blocker',
      'why',
      'tried',
      'mode',
    ])
    expect(schema['additionalProperties']).toBe(false)
  })
})

describe('texts Claude reads', () => {
  test('the gate, context and refusal lines', () => {
    expect(gateDenial(task(1))).toBe(
      'Waiting for the user to finish HTL task #1 "Log in to the GitHub CLI". End your turn now.',
    )
    expect(
      contextLine([task(1), task(2, { ...SECRET, mode: 'parallel' })]),
    ).toBe(
      'Open HTL tasks waiting for the user: #1 "Log in to the GitHub CLI" (now), #2 "Create the Twilio auth token" (parallel). Don\'t assume they are done.',
    )
    expect(refusalText(['title is missing', 'mode is missing'], TERMS)).toBe(
      'The task was not assigned: title is missing; mode is missing. Fix these fields and call mcp__htl__assign_task again.',
    )
  })
})

describe('texts the user reads', () => {
  test('the reminder and status lines count tasks', () => {
    expect(reminderLine([task(1)], TERMS)).toBe(
      '⏳ htl: waiting for you on task #1 · /htl',
    )
    expect(reminderLine([task(1), task(3)], TERMS)).toBe(
      '⏳ htl: waiting for you on tasks #1, #3 · /htl',
    )
    expect(statusLine(1, TERMS)).toBe('1 task waiting for you · /htl')
    expect(statusLine(2, TERMS)).toBe('2 tasks waiting for you · /htl')
  })

  test('the card header shows the focus hint only when asked', () => {
    expect(cardHeader(task(1), 1, 2, FOCUS_HINT)).toBe(
      '#1 · NOW · 1 of 2 · ctrl+x tab to use',
    )
    expect(cardHeader(task(4, { ...LOGIN, mode: 'parallel' }), 2, 2)).toBe(
      '#4 · PARALLEL · 2 of 2',
    )
  })
})

describe('every text, pinned', () => {
  test('the tool description under 1password', () => {
    expect(toolDescription('1password', TERMS)).toBe(
      [
        'Assign a job to the user that you truly cannot do yourself: a 2FA, browser or CAPTCHA login, a secret that does not exist yet, a physical action, a payment or a legal signature, or a system your tools cannot reach. The user sees it in a pane with Accept, Reject and "You can do this", and can add a message. Their answer arrives later as a user message.',
        '',
        'Rules:',
        '- This is a last resort. First try the job yourself, with your own tools.',
        '- Never use it for work your tools can do: edit or create files, run commands, install packages, commit, generate a random secret, or write a placeholder in .env.example.',
        '- For a question or a choice, use AskUserQuestion. If facts are missing, ask in plain text. Neither is a task.',
        "- If the user already said they will do it, don't assign it.",
        '- Never ask the user for a secret value, and never print one.',
        '- Never feed a password into sudo or a login prompt, even from a password manager. Assign the command to the user as a no_access task.',
        '- Put related steps in one task, and never assign the same job twice.',
        '- Pick mode "now" when your next step needs the result, else "parallel".',
        '',
        'The 1Password CLI (op) is installed:',
        '- Use a secret that is in 1Password through an op://<vault>/<item>/<field> reference: run the command with `op run --env-file=<file> -- <cmd>`, or render a config with `op inject -i <template> -o <file>`. A resolved file must be gitignored and deleted when you are done. For a secret the user keeps somewhere else, use it from there.',
        '- Never let a value reach your output: don\'t run `op read`, `--reveal` or `--no-masking` in your own shell. To check that an item exists, discard the output: `op item get "<item>" --vault "<vault>" > /dev/null`.',
        '- A 1Password Touch ID or unlock prompt is not a task: the user answers it. If `op` fails because 1Password is locked, not signed in, or its CLI integration is off, that is not a task either: say so in one line and ask whether to use 1Password or where else they keep the secret.',
        '- A "secret" task is only for a secret you could not find in 1Password: "tried" says what you checked in 1Password. The steps may suggest an op://<vault>/<item>/<field> reference to save it under, with real names; the user decides where it goes.',
      ].join('\n'),
    )
  })
  test('the input schema under 1password', () => {
    expect(inputSchema('1password', TERMS)).toEqual({
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description:
            'The job as a short instruction, e.g. "Log in to the GitHub CLI".',
        },
        steps: {
          type: 'string',
          description:
            'Exact Markdown steps for the user. A shell command they should run gets a ! prefix, so they can paste it into Claude Code: `! gh auth login`. For a secret task, the steps may suggest a 1Password reference to save it under, `op://<vault>/<item>/<field>` with real names; the user decides where it goes.',
        },
        blocker: {
          type: 'string',
          enum: [
            'secret',
            'login',
            'physical',
            'payment_or_legal',
            'no_access',
          ],
          description:
            'secret: an API key, token or password that does not exist yet. login: a 2FA, browser or CAPTCHA login, or a sign-up. physical: something only hands can do: plug in a device or cable, touch a security key, press a button. payment_or_legal: a payment, a plan change, a signature or an agreement. no_access: a machine, network or app your tools cannot reach: another computer, a VPN, a GUI-only setting, a sudo password prompt.',
        },
        why: {
          type: 'string',
          description: 'Why no tool you have can do it, in 1-2 sentences.',
        },
        tried: {
          type: 'string',
          description: 'What you already tried or checked, and what happened.',
        },
        mode: {
          type: 'string',
          enum: ['now', 'parallel'],
          description:
            'now: your next step needs the result, so you stop and wait. parallel: you keep doing only work that does not depend on it.',
        },
        check: {
          type: 'string',
          description:
            'How you will confirm it is done, e.g. `gh auth status`. Optional.',
        },
      },
      required: ['title', 'steps', 'blocker', 'why', 'tried', 'mode'],
      additionalProperties: false,
    })
  })
  test('the tool description under none', () => {
    expect(toolDescription('none', TERMS)).toBe(
      [
        'Assign a job to the user that you truly cannot do yourself: a 2FA, browser or CAPTCHA login, a secret that does not exist yet, a physical action, a payment or a legal signature, or a system your tools cannot reach. The user sees it in a pane with Accept, Reject and "You can do this", and can add a message. Their answer arrives later as a user message.',
        '',
        'Rules:',
        '- This is a last resort. First try the job yourself, with your own tools.',
        '- Never use it for work your tools can do: edit or create files, run commands, install packages, commit, generate a random secret, or write a placeholder in .env.example.',
        '- For a question or a choice, use AskUserQuestion. If facts are missing, ask in plain text. Neither is a task.',
        "- If the user already said they will do it, don't assign it.",
        '- Never ask the user for a secret value, and never print one.',
        '- Never feed a password into sudo or a login prompt, even from a password manager. Assign the command to the user as a no_access task.',
        '- Put related steps in one task, and never assign the same job twice.',
        '- Pick mode "now" when your next step needs the result, else "parallel".',
      ].join('\n'),
    )
  })
  test('the input schema under none', () => {
    expect(inputSchema('none', TERMS)).toEqual({
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description:
            'The job as a short instruction, e.g. "Log in to the GitHub CLI".',
        },
        steps: {
          type: 'string',
          description:
            'Exact Markdown steps for the user. A shell command they should run gets a ! prefix, so they can paste it into Claude Code: `! gh auth login`.',
        },
        blocker: {
          type: 'string',
          enum: [
            'secret',
            'login',
            'physical',
            'payment_or_legal',
            'no_access',
          ],
          description:
            'secret: an API key, token or password that does not exist yet. login: a 2FA, browser or CAPTCHA login, or a sign-up. physical: something only hands can do: plug in a device or cable, touch a security key, press a button. payment_or_legal: a payment, a plan change, a signature or an agreement. no_access: a machine, network or app your tools cannot reach: another computer, a VPN, a GUI-only setting, a sudo password prompt.',
        },
        why: {
          type: 'string',
          description: 'Why no tool you have can do it, in 1-2 sentences.',
        },
        tried: {
          type: 'string',
          description: 'What you already tried or checked, and what happened.',
        },
        mode: {
          type: 'string',
          enum: ['now', 'parallel'],
          description:
            'now: your next step needs the result, so you stop and wait. parallel: you keep doing only work that does not depend on it.',
        },
        check: {
          type: 'string',
          description:
            'How you will confirm it is done, e.g. `gh auth status`. Optional.',
        },
      },
      required: ['title', 'steps', 'blocker', 'why', 'tried', 'mode'],
      additionalProperties: false,
    })
  })
  test('the toasts', () => {
    expect(assignedToast(task(1), TERMS)).toBe(
      'htl: Claude needs you for task #1 "Log in to the GitHub CLI"',
    )
    expect(decisionToast(task(1), 'accept', TERMS)).toBe(
      'htl: task #1 accepted',
    )
    expect(decisionToast(task(1), 'reject', TERMS)).toBe(
      'htl: task #1 rejected',
    )
    expect(decisionToast(task(1), 'handback', TERMS)).toBe(
      'htl: task #1 handed back to Claude',
    )
    expect(notSentToast(task(1), TERMS)).toBe(
      'htl: the answer to task #1 was not sent. Answer again in /htl.',
    )
  })
  test('the /htl replies', () => {
    expect(answeringText(task(1), 'accept', TERMS)).toBe(
      'Sending your answer to task #1 "Log in to the GitHub CLI": accepted. If /htl still lists the task, it was not sent.',
    )
    expect(answeringText(task(1), 'reject', TERMS)).toBe(
      'Sending your answer to task #1 "Log in to the GitHub CLI": rejected. If /htl still lists the task, it was not sent.',
    )
    expect(answeringText(task(1), 'handback', TERMS)).toBe(
      'Sending your answer to task #1 "Log in to the GitHub CLI": handed back to Claude. If /htl still lists the task, it was not sent.',
    )
    expect(htlUsage(TERMS)).toBe(
      'Answer a task with /htl accept, /htl reject or /htl handback ("you can do this") and its number, then an optional message: /htl accept 1 done with my work account.',
    )
    expect(notYours(TERMS)).toBe(
      'Only you can answer an HTL task: type the command yourself, here or through Remote Control.',
    )
    expect(notOpenText(2, [])).toBe('No open HTL tasks.')
    expect(notOpenText(2, [task(1), task(3)])).toBe(
      'No open task #2. Open: #1, #3.',
    )
    expect(
      taskListText([task(1), task(2, { ...SECRET, mode: 'parallel' })], TERMS),
    ).toBe(
      [
        'Open HTL tasks:',
        '',
        '#1 · NOW · Log in to the GitHub CLI',
        'login: The login needs a browser and a 2FA code.',
        'Run `! gh auth login` and finish the browser login.',
        '',
        '#2 · PARALLEL · Create the Twilio auth token',
        'secret: The token does not exist yet.',
        'Create a token in the Twilio console and save it in 1Password as `op://Private/Twilio/auth token`.',
        '',
        'Answer a task with /htl accept, /htl reject or /htl handback ("you can do this") and its number, then an optional message: /htl accept 1 done with my work account.',
      ].join('\n'),
    )
  })
  test('the labels', () => {
    expect(
      (['accept', 'reject', 'handback'] as const).map(decisionLabel),
    ).toEqual(['Accept', 'Reject', 'You can do this'])
    expect(
      (
        [
          'secret',
          'login',
          'physical',
          'payment_or_legal',
          'no_access',
        ] as const
      ).map(blockerLabel),
    ).toEqual(['secret', 'login', 'physical', 'payment or legal', 'no access'])
  })
  test('the subagent refusal', () => {
    expect(SUBAGENT_REFUSAL).toBe(
      'Only the main conversation can assign tasks; put the blocker in your final report.',
    )
  })
})
