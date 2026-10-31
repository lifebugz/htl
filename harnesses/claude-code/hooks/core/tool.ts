// GENERATED from packages/core - edit there, run `bun run core:sync`
import { unreachable } from './guards'
import { BLOCKERS, MODES, REQUIRED } from './request'
import type { SecretsMode, Terms } from './types'

export const TOOL_NAME = 'assign_task'

function generalRules(terms: Terms): string {
  return `Assign a job to the user that you truly cannot do yourself: a 2FA, browser or CAPTCHA login, a secret that does not exist yet, a physical action, a payment or a legal signature, or a system your tools cannot reach. The user sees it in a pane with Accept, Reject and "You can do this", and can add a message. Their answer arrives later as a user message.

Rules:
- This is a last resort. First try the job yourself, with your own tools.
- Never use it for work your tools can do: edit or create files, run commands, install packages, commit, generate a random secret, or write a placeholder in .env.example.
- For a question or a choice, use ${terms.askTool}. If facts are missing, ask in plain text. Neither is a task.
- If the user already said they will do it, don't assign it.
- Never ask the user for a secret value, and never print one.
- Never feed a password into sudo or a login prompt, even from a password manager. Assign the command to the user as a no_access task.
- Put related steps in one task, and never assign the same job twice.
- Pick mode "now" when your next step needs the result, else "parallel".`
}

const ONE_PASSWORD_RULES = `

The 1Password CLI (op) is installed:
- Use a secret that is in 1Password through an op://<vault>/<item>/<field> reference: run the command with \`op run --env-file=<file> -- <cmd>\`, or render a config with \`op inject -i <template> -o <file>\`. A resolved file must be gitignored and deleted when you are done. For a secret the user keeps somewhere else, use it from there.
- Never let a value reach your output: don't run \`op read\`, \`--reveal\` or \`--no-masking\` in your own shell. To check that an item exists, discard the output: \`op item get "<item>" --vault "<vault>" > /dev/null\`.
- A 1Password Touch ID or unlock prompt is not a task: the user answers it. If \`op\` fails because 1Password is locked, not signed in, or its CLI integration is off, that is not a task either: say so in one line and ask whether to use 1Password or where else they keep the secret.
- A "secret" task is only for a secret you could not find in 1Password: "tried" says what you checked in 1Password. The steps may suggest an op://<vault>/<item>/<field> reference to save it under, with real names; the user decides where it goes.`

export function toolDescription(secrets: SecretsMode, terms: Terms): string {
  switch (secrets) {
    case '1password':
      return generalRules(terms) + ONE_PASSWORD_RULES
    case 'none':
      return generalRules(terms)
    default:
      return unreachable(secrets)
  }
}

function stepsText(terms: Terms): string {
  return `Exact Markdown steps for the user. A shell command they should run gets a ${terms.shellPrefix} prefix, so they can paste it into ${terms.host}: \`${terms.shellPrefix} gh auth login\`.`
}

const STEPS_FOR_SECRETS =
  ' For a secret task, the steps may suggest a 1Password reference to save it under, `op://<vault>/<item>/<field>` with real names; the user decides where it goes.'

export function inputSchema(
  secrets: SecretsMode,
  terms: Terms,
): Readonly<Record<string, unknown>> {
  const steps = stepsText(terms)
  return {
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
          secrets === '1password' ? steps + STEPS_FOR_SECRETS : steps,
      },
      blocker: {
        type: 'string',
        enum: BLOCKERS,
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
        enum: MODES,
        description:
          'now: your next step needs the result, so you stop and wait. parallel: you keep doing only work that does not depend on it.',
      },
      check: {
        type: 'string',
        description:
          'How you will confirm it is done, e.g. `gh auth status`. Optional.',
      },
    },
    required: REQUIRED,
    additionalProperties: false,
  }
}
