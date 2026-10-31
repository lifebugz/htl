import { isOneOf } from './guards'
import type { Origin } from './types'

const ANSWERING: readonly Origin[] = ['user', 'remote']
const REMOTE: readonly Origin[] = ['remote']

export function answersTasks(origin: Origin): boolean {
  return isOneOf(ANSWERING, origin)
}

export function isRemote(origin: Origin): boolean {
  return isOneOf(REMOTE, origin)
}
