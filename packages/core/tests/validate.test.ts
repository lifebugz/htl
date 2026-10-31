import { describe, expect, test } from 'bun:test'

import type { ClosedTask } from '../src/types'
import { MAX_OPEN, sameTitle, validateRequest } from '../src/validate'
import { EMPTY, LOGIN, OTHER, SECRET, task } from './helpers'

describe('validateRequest', () => {
  test('a fourth open task is refused', () => {
    const open = [task(1), task(2), task(3)].map((one, i) => ({
      ...one,
      title: `job ${String(i)}`,
    }))
    expect(open.length).toBe(MAX_OPEN)
    expect(validateRequest(LOGIN, { ...EMPTY, open }, OTHER)).toBe(
      'Not assigned. The user already has 3 open tasks. Wait for them.',
    )
    expect(
      validateRequest(LOGIN, { ...EMPTY, open: open.slice(0, 2) }, OTHER),
    ).toBeUndefined()
  })

  test('the same title as an open task is refused', () => {
    expect(
      validateRequest(
        { ...LOGIN, title: '  log IN to the   github cli ' },
        { ...EMPTY, open: [task(4)] },
        OTHER,
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

    expect(
      validateRequest(retry, { ...EMPTY, closed: [rejected] }, OTHER),
    ).toBe(
      'Not assigned. The user already rejected task #2 "Log in to the GitHub CLI". Don\'t assign it again. Find another way, or tell the user what stays blocked.',
    )
    expect(validateRequest(retry, { ...EMPTY, closed: [handed] }, OTHER)).toBe(
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
      validateRequest(LOGIN, { ...EMPTY, closed: [accepted] }, OTHER),
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
      expect(validateRequest(SECRET, EMPTY, OTHER)).toBeUndefined()
      expect(
        validateRequest(
          { ...SECRET, tried: 'Searched 1Password: none.' },
          EMPTY,
          OTHER,
        ),
      ).toBeUndefined()
    })

    test('a secret task with no 1Password evidence in tried is refused', () => {
      expect(
        validateRequest(
          { ...SECRET, tried: 'Looked in .env: empty.' },
          EMPTY,
          OTHER,
        ),
      ).toBe(NO_EVIDENCE)
    })

    test('the user decides where a new secret goes, so steps need no op:// reference', () => {
      expect(
        validateRequest(
          { ...SECRET, steps: 'Create the token and paste it into .env.' },
          EMPTY,
          OTHER,
        ),
      ).toBeUndefined()
    })

    test('real vault, item and field names may hold spaces', () => {
      expect(
        validateRequest(
          {
            ...SECRET,
            steps: 'Save it as `op://Team Vault/GitHub PAT/credential`.',
          },
          EMPTY,
          OTHER,
        ),
      ).toBeUndefined()
    })

    test('under none, a secret task needs no 1Password evidence', () => {
      expect(
        validateRequest(
          { ...SECRET, tried: 'Looked in .env.', steps: 'Paste it in .env.' },
          { ...EMPTY, secrets: 'none' },
          OTHER,
        ),
      ).toBeUndefined()
    })

    test('other blockers need no 1Password evidence', () => {
      expect(validateRequest(LOGIN, EMPTY, OTHER)).toBeUndefined()
    })
  })
})
