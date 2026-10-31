import { isOneOf, isRecord } from './guards'
import type { Blocker, HtlRequest, Mode } from './types'

export const BLOCKERS: readonly Blocker[] = [
  'secret',
  'login',
  'physical',
  'payment_or_legal',
  'no_access',
]
export const MODES: readonly Mode[] = ['now', 'parallel']
export const REQUIRED = [
  'title',
  'steps',
  'blocker',
  'why',
  'tried',
  'mode',
] as const
const FIELDS: ReadonlySet<string> = new Set([...REQUIRED, 'check'])

export type Parsed =
  | { request: HtlRequest; problems?: undefined }
  | { request?: undefined; problems: readonly string[] }

type Field<T> =
  | { readonly value: T; readonly problem?: undefined }
  | { readonly value?: undefined; readonly problem: string }

function textField(
  input: Readonly<Record<string, unknown>>,
  name: string,
): Field<string> {
  const value = input[name]
  if (value === undefined) {
    return { problem: `${name} is missing` }
  }
  if (typeof value !== 'string') {
    return { problem: `${name} must be a string` }
  }
  if (value.trim() === '') {
    return { problem: `${name} is empty` }
  }
  return { value: value.trim() }
}

function choiceField<T extends string>(
  input: Readonly<Record<string, unknown>>,
  name: string,
  options: readonly T[],
): Field<T> {
  const value = input[name]
  if (value === undefined) {
    return { problem: `${name} is missing` }
  }
  if (!isOneOf(options, value)) {
    return { problem: `${name} must be one of: ${options.join(', ')}` }
  }
  return { value }
}

function checkField(value: unknown): Field<string | undefined> {
  if (value === undefined) {
    return { value: undefined }
  }
  if (typeof value !== 'string') {
    return { problem: 'check must be a string' }
  }
  return { value: value.trim() === '' ? undefined : value.trim() }
}

export function parseRequest(
  e: unknown,
  envelope: ReadonlySet<string>,
): Parsed {
  if (!isRecord(e)) {
    return { problems: ['the input must be an object'] }
  }
  const title = textField(e, 'title')
  const steps = textField(e, 'steps')
  const blocker = choiceField(e, 'blocker', BLOCKERS)
  const why = textField(e, 'why')
  const tried = textField(e, 'tried')
  const mode = choiceField(e, 'mode', MODES)
  const check = checkField(e['check'])

  const extra = Object.keys(e).filter(
    key => !FIELDS.has(key) && !envelope.has(key),
  )
  const problems = [
    ...[title, steps, blocker, why, tried, mode, check].flatMap(field =>
      field.problem === undefined ? [] : [field.problem],
    ),
    ...(extra.length > 0 ? [`unknown fields: ${extra.join(', ')}`] : []),
  ]

  if (
    problems.length > 0 ||
    title.value === undefined ||
    steps.value === undefined ||
    blocker.value === undefined ||
    why.value === undefined ||
    tried.value === undefined ||
    mode.value === undefined
  ) {
    return { problems }
  }
  const request: HtlRequest = {
    title: title.value,
    steps: steps.value,
    blocker: blocker.value,
    why: why.value,
    tried: tried.value,
    mode: mode.value,
  }
  return {
    request:
      check.value === undefined ? request : { ...request, check: check.value },
  }
}
