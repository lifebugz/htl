import type { PromptOrigin } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import type { ClosedTask, HtlRequest, HtlTask } from '../types'
import {
  HTL_USAGE,
  MAX_OPEN,
  NOT_YOURS,
  SUBAGENT_REFUSAL,
  answeringText,
  answersTasks,
  assignedText,
  assignedToast,
  blockerLabel,
  cardHeader,
  contextLine,
  decisionLabel,
  decisionPrompt,
  decisionToast,
  gateDenial,
  inputSchema,
  isRemote,
  notOpenText,
  notSentToast,
  parseHtlArgs,
  parseRequest,
  refusalText,
  reminderLine,
  sameTitle,
  statusLine,
  taskListText,
  toolDescription,
  validateRequest,
} from '../hooks/tasks'

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

function isKind(value: string): value is PromptOrigin['kind'] {
  return value in ANSWERS
}

const without = (field: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(LOGIN).filter(([key]) => key !== field))

describe('parseRequest', () => {
  test('a full request parses, trimmed, with and without check', () => {
    expect(parseRequest({ ...LOGIN, title: '  Log in  ' })).toEqual({
      request: { ...LOGIN, title: 'Log in' },
    })
    expect(parseRequest({ ...LOGIN, check: ' gh auth status ' })).toEqual({
      request: { ...LOGIN, check: 'gh auth status' },
    })
  })

  test('the tool.call envelope fields are not extra fields', () => {
    expect(
      parseRequest({
        ...LOGIN,
        tool: 'mcp__htl__assign_task',
        tool_use_id: 'toolu_1',
        agentId: 'a1',
        requestMeta: {},
        consent: 'yes',
      }),
    ).toEqual({ request: LOGIN })
  })

  for (const field of ['title', 'steps', 'why', 'tried'] as const) {
    test(`${field}: missing, blank and not a string are refused`, () => {
      expect(parseRequest(without(field)).problems).toEqual([
        `${field} is missing`,
      ])
      expect(parseRequest({ ...LOGIN, [field]: '   ' }).problems).toEqual([
        `${field} is empty`,
      ])
      expect(parseRequest({ ...LOGIN, [field]: 7 }).problems).toEqual([
        `${field} must be a string`,
      ])
    })
  }

  test('blocker and mode take only their listed values', () => {
    expect(parseRequest({ ...LOGIN, blocker: 'hard' }).problems).toEqual([
      'blocker must be one of: secret, login, physical, payment_or_legal, no_access',
    ])
    expect(parseRequest({ ...LOGIN, mode: 'later' }).problems).toEqual([
      'mode must be one of: now, parallel',
    ])
    expect(parseRequest(without('mode')).problems).toEqual(['mode is missing'])
  })

  test('check must be a string; a blank check is left out', () => {
    expect(parseRequest({ ...LOGIN, check: 3 }).problems).toEqual([
      'check must be a string',
    ])
    expect(parseRequest({ ...LOGIN, check: '  ' })).toEqual({
      request: LOGIN,
    })
  })

  test('extra fields are refused, and every problem is listed', () => {
    expect(parseRequest({ ...LOGIN, urgency: 'high' }).problems).toEqual([
      'unknown fields: urgency',
    ])
    expect(parseRequest({ title: '', mode: 'soon', x: 1 }).problems).toEqual([
      'title is empty',
      'steps is missing',
      'blocker is missing',
      'why is missing',
      'tried is missing',
      'mode must be one of: now, parallel',
      'unknown fields: x',
    ])
  })

  test('an input that is not an object is refused', () => {
    expect(parseRequest(null).problems).toEqual(['the input must be an object'])
    expect(parseRequest(['x']).problems).toEqual([
      'the input must be an object',
    ])
  })
})

describe('validateRequest', () => {
  test('a fourth open task is refused', () => {
    const open = [task(1), task(2), task(3)].map((one, i) => ({
      ...one,
      title: `job ${String(i)}`,
    }))
    expect(open.length).toBe(MAX_OPEN)
    expect(validateRequest(LOGIN, { ...EMPTY, open })).toBe(
      'Not assigned. The user already has 3 open tasks. Wait for them.',
    )
    expect(
      validateRequest(LOGIN, { ...EMPTY, open: open.slice(0, 2) }),
    ).toBeUndefined()
  })

  test('the same title as an open task is refused', () => {
    expect(
      validateRequest(
        { ...LOGIN, title: '  log IN to the   github cli ' },
        { ...EMPTY, open: [task(4)] },
      ),
    ).toBe(
      'Not assigned. Task #4 "Log in to the GitHub CLI" is already open. Don\'t assign it twice; wait for the user.',
    )
  })

  test('a rejected or handed-back title is refused, whatever its case and spacing', () => {
    const rejected: ClosedTask = {
      id: 2,
      title: LOGIN.title,
      decision: 'reject',
    }
    const handed: ClosedTask = { ...rejected, decision: 'handback' }
    const retry = { ...LOGIN, title: ' LOG IN to the GitHub  CLI' }

    expect(validateRequest(retry, { ...EMPTY, closed: [rejected] })).toBe(
      'Not assigned. The user already rejected task #2 "Log in to the GitHub CLI". Don\'t assign it again. Find another way, or tell the user what stays blocked.',
    )
    expect(validateRequest(retry, { ...EMPTY, closed: [handed] })).toBe(
      'Not assigned. The user already said you can do task #2 "Log in to the GitHub CLI" yourself. Do it with your own tools; don\'t assign it again.',
    )
  })

  test('an accepted title may be assigned again (the login can expire)', () => {
    const accepted: ClosedTask = {
      id: 2,
      title: LOGIN.title,
      decision: 'accept',
    }
    expect(
      validateRequest(LOGIN, { ...EMPTY, closed: [accepted] }),
    ).toBeUndefined()
  })

  test('sameTitle trims, lowercases and folds spaces', () => {
    expect(sameTitle('  Log  In ', 'log in')).toBe(true)
    expect(sameTitle('Log in', 'Log out')).toBe(false)
  })

  describe('1Password', () => {
    const NO_EVIDENCE =
      'Not assigned. The 1Password CLI is installed, so check 1Password first. If the secret is there, reference it as `op://…` and run the command with `op run` or `op inject`. Assign a task only if the item is missing: check with `op item get "<item>" --vault "<vault>" > /dev/null`, and say in `tried` what you found. Run the check yourself; don\'t ask the user to.'

    test('a secret task that names 1Password and an op:// reference is allowed', () => {
      expect(validateRequest(SECRET, EMPTY)).toBeUndefined()
      expect(
        validateRequest(
          { ...SECRET, tried: 'Searched 1Password: none.' },
          EMPTY,
        ),
      ).toBeUndefined()
    })

    test('a secret task with no 1Password evidence in tried is refused', () => {
      expect(
        validateRequest({ ...SECRET, tried: 'Looked in .env: empty.' }, EMPTY),
      ).toBe(NO_EVIDENCE)
    })

    test('the user decides where a new secret goes, so steps need no op:// reference', () => {
      expect(
        validateRequest(
          { ...SECRET, steps: 'Create the token and paste it into .env.' },
          EMPTY,
        ),
      ).toBeUndefined()
    })

    test('the op://<vault>/<item>/<field> placeholder is refused, with or without op', () => {
      const PLACEHOLDER =
        'Not assigned. The steps hold the op://<vault>/<item>/<field> placeholder. Name the real vault, item and field, or leave the op:// suggestion out, then call mcp__htl__assign_task again.'
      const steps = 'Save it as `op://<vault>/<item>/<field>`.'
      expect(validateRequest({ ...SECRET, steps }, EMPTY)).toBe(PLACEHOLDER)
      expect(
        validateRequest({ ...SECRET, steps }, { ...EMPTY, secrets: 'none' }),
      ).toBe(PLACEHOLDER)
      expect(
        validateRequest(
          { ...SECRET, steps: 'Save it as `op://Private/<item>/credential`.' },
          EMPTY,
        ),
      ).toBe(PLACEHOLDER)
    })

    test('real vault, item and field names may hold spaces', () => {
      expect(
        validateRequest(
          {
            ...SECRET,
            steps: 'Save it as `op://Team Vault/GitHub PAT/credential`.',
          },
          EMPTY,
        ),
      ).toBeUndefined()
    })

    test('under none, a secret task needs no 1Password evidence', () => {
      expect(
        validateRequest(
          { ...SECRET, tried: 'Looked in .env.', steps: 'Paste it in .env.' },
          { ...EMPTY, secrets: 'none' },
        ),
      ).toBeUndefined()
    })

    test('other blockers need no 1Password evidence', () => {
      expect(validateRequest(LOGIN, EMPTY)).toBeUndefined()
    })
  })
})

describe('answersTasks', () => {
  test('only what the user sends lifts the gate', () => {
    expect(
      Object.keys(ANSWERS)
        .filter(isKind)
        .map(kind => [kind, answersTasks(kind)]),
    ).toEqual(Object.entries(ANSWERS))
  })
})

describe('/htl arguments', () => {
  test('no arguments opens the pane', () => {
    expect(parseHtlArgs('')).toEqual({ kind: 'open' })
    expect(parseHtlArgs('   ')).toEqual({ kind: 'open' })
  })

  test('a decision, a task number with or without #, and the rest as the message', () => {
    expect(parseHtlArgs(' ACCEPT #3 ')).toEqual({
      kind: 'answer',
      decision: 'accept',
      taskId: 3,
      message: '',
    })
    expect(parseHtlArgs('handback 12 use the token\nin CI ')).toEqual({
      kind: 'answer',
      decision: 'handback',
      taskId: 12,
      message: 'use the token\nin CI',
    })
  })

  test('anything else is usage', () => {
    for (const args of [
      'accept',
      'accept one',
      'yes 1',
      '1 accept',
      'reject #',
    ]) {
      expect(parseHtlArgs(args)).toEqual({ kind: 'usage' })
    }
  })

  test('only Remote Control and a Slack ping count as remote', () => {
    expect(isRemote('bridge')).toBe(true)
    expect(isRemote('slack-ping')).toBe(true)
    expect(isRemote('composer')).toBe(false)
    expect(isRemote('sdk')).toBe(false)
  })
})

describe('the tool description', () => {
  test('holds the 1Password rules only under 1password', () => {
    expect(toolDescription('1password')).toContain('op run --env-file=')
    expect(toolDescription('1password')).toContain('op inject -i')
    expect(toolDescription('none')).not.toContain('1Password')
    expect(toolDescription('none')).not.toContain('op://')
  })

  test('the rules leave permissions to Claude Code', () => {
    for (const secrets of ['1password', 'none'] as const) {
      expect(toolDescription(secrets)).not.toMatch(
        /auto mode|denied|permission/i,
      )
    }
  })

  test('the rule against asking for or printing a secret holds with or without op', () => {
    const rule = 'Never ask the user for a secret value, and never print one.'
    expect(toolDescription('1password')).toContain(rule)
    expect(toolDescription('none')).toContain(rule)
  })

  test('both versions fit the 4096 characters the model is sent', () => {
    expect(toolDescription('1password').length).toBeLessThanOrEqual(4096)
    expect(toolDescription('none').length).toBeLessThanOrEqual(4096)
  })

  test('the steps suggest an op:// reference only under 1password', () => {
    const stepsOf = (schema: Readonly<Record<string, unknown>>): unknown =>
      JSON.stringify(schema['properties'])
    expect(stepsOf(inputSchema('1password'))).toContain(
      'may suggest a 1Password reference to save it under',
    )
    expect(stepsOf(inputSchema('none'))).not.toContain('1Password')
  })

  test('the schema requires every field but check, and nothing else', () => {
    const schema = inputSchema('1password')
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
  test('the now and parallel results', () => {
    expect(assignedText(task(1))).toBe(
      'Assigned as task #1 (now). End your turn now with one short line saying what you are waiting for. Other tool calls are refused until the user answers; the answer arrives as the next user message.',
    )
    expect(assignedText(task(2, { ...LOGIN, mode: 'parallel' }))).toBe(
      "Assigned as task #2 (parallel). Keep working only on what does not depend on it. Don't do it yourself, don't assume it's done. When that work is done, end your turn and say you are waiting for task #2.",
    )
  })

  test('the gate, context and refusal lines', () => {
    expect(gateDenial(task(1))).toBe(
      'Waiting for the user to finish HTL task #1 "Log in to the GitHub CLI". End your turn now.',
    )
    expect(
      contextLine([task(1), task(2, { ...SECRET, mode: 'parallel' })]),
    ).toBe(
      'Open HTL tasks waiting for the user: #1 "Log in to the GitHub CLI" (now), #2 "Create the Twilio auth token" (parallel). Don\'t assume they are done.',
    )
    expect(refusalText(['title is missing', 'mode is missing'])).toBe(
      'The task was not assigned: title is missing; mode is missing. Fix these fields and call mcp__htl__assign_task again.',
    )
  })

  describe('decisionPrompt', () => {
    const checked = task(1, { ...LOGIN, check: 'gh auth status' })

    test('accept, with a check and a message', () => {
      expect(decisionPrompt(checked, 'accept', '  used my work account ')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": accepted, I did it.\nMy message: used my work account\nCheck it worked (run `gh auth status` or re-run what failed), then continue.',
      )
    })

    test('accept, with no check and no message', () => {
      expect(decisionPrompt(task(1), 'accept', '   ')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": accepted, I did it.\nCheck it worked (re-run what failed), then continue.',
      )
    })

    test('reject, with and without a message', () => {
      expect(decisionPrompt(checked, 'reject', 'not today')).toBe(
        "HTL task #1 \"Log in to the GitHub CLI\": rejected, I won't do it.\nMy message: not today\nDon't assume it's done. Find another way, or tell me what stays blocked.",
      )
      expect(decisionPrompt(checked, 'reject', '')).toBe(
        "HTL task #1 \"Log in to the GitHub CLI\": rejected, I won't do it.\nDon't assume it's done. Find another way, or tell me what stays blocked.",
      )
    })

    test('you can do this, with and without a message', () => {
      expect(decisionPrompt(checked, 'handback', 'use the token in CI')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": you can do this yourself.\nMy message: use the token in CI\nDo it with your own tools. Don\'t assign it to me again.',
      )
      expect(decisionPrompt(checked, 'handback', '')).toBe(
        'HTL task #1 "Log in to the GitHub CLI": you can do this yourself.\nDo it with your own tools. Don\'t assign it to me again.',
      )
    })
  })
})

describe('texts the user reads', () => {
  test('the reminder and status lines count tasks', () => {
    expect(reminderLine([task(1)])).toBe(
      '⏳ htl: waiting for you on task #1 · /htl',
    )
    expect(reminderLine([task(1), task(3)])).toBe(
      '⏳ htl: waiting for you on tasks #1, #3 · /htl',
    )
    expect(statusLine(1)).toBe('1 task waiting for you · /htl')
    expect(statusLine(2)).toBe('2 tasks waiting for you · /htl')
  })

  test('the card header shows the focus hint only when asked', () => {
    expect(cardHeader(task(1), 1, 2, true)).toBe(
      '#1 · NOW · 1 of 2 · ctrl+x tab to use',
    )
    expect(
      cardHeader(task(4, { ...LOGIN, mode: 'parallel' }), 2, 2, false),
    ).toBe('#4 · PARALLEL · 2 of 2')
  })
})

describe('every text, pinned', () => {
  test('the tool description under 1password', () => {
    expect(toolDescription('1password')).toBe(
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
    expect(inputSchema('1password')).toEqual({
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
    expect(toolDescription('none')).toBe(
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
    expect(inputSchema('none')).toEqual({
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
    expect(assignedToast(task(1))).toBe(
      'htl: Claude needs you for task #1 "Log in to the GitHub CLI"',
    )
    expect(decisionToast(task(1), 'accept')).toBe('htl: task #1 accepted')
    expect(decisionToast(task(1), 'reject')).toBe('htl: task #1 rejected')
    expect(decisionToast(task(1), 'handback')).toBe(
      'htl: task #1 handed back to Claude',
    )
    expect(notSentToast(task(1))).toBe(
      'htl: the answer to task #1 was not sent. Answer again in /htl.',
    )
  })
  test('the /htl replies', () => {
    expect(answeringText(task(1), 'accept')).toBe(
      'Sending your answer to task #1 "Log in to the GitHub CLI": accepted. If /htl still lists the task, it was not sent.',
    )
    expect(answeringText(task(1), 'reject')).toBe(
      'Sending your answer to task #1 "Log in to the GitHub CLI": rejected. If /htl still lists the task, it was not sent.',
    )
    expect(answeringText(task(1), 'handback')).toBe(
      'Sending your answer to task #1 "Log in to the GitHub CLI": handed back to Claude. If /htl still lists the task, it was not sent.',
    )
    expect(HTL_USAGE).toBe(
      'Answer a task with /htl accept, /htl reject or /htl handback ("you can do this") and its number, then an optional message: /htl accept 1 done with my work account.',
    )
    expect(NOT_YOURS).toBe(
      'Only you can answer an HTL task: type the command yourself, here or through Remote Control.',
    )
    expect(notOpenText(2, [])).toBe('No open HTL tasks.')
    expect(notOpenText(2, [task(1), task(3)])).toBe(
      'No open task #2. Open: #1, #3.',
    )
    expect(
      taskListText([task(1), task(2, { ...SECRET, mode: 'parallel' })]),
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
