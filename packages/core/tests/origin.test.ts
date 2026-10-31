import { expect, test } from 'bun:test'

import { answersTasks, isRemote } from '../src/origin'
import type { Origin } from '../src/types'

const ORIGINS: Readonly<
  Record<Origin, { readonly answers: boolean; readonly remote: boolean }>
> = {
  user: { answers: true, remote: false },
  remote: { answers: true, remote: true },
  self: { answers: false, remote: false },
  automation: { answers: false, remote: false },
}

const isOrigin = (value: string): value is Origin => value in ORIGINS

test('only the user, here or from afar, answers tasks and lifts the gate', () => {
  const actual = Object.fromEntries(
    Object.keys(ORIGINS)
      .filter(isOrigin)
      .map(origin => [
        origin,
        { answers: answersTasks(origin), remote: isRemote(origin) },
      ]),
  )
  expect(actual).toEqual(ORIGINS)
})
