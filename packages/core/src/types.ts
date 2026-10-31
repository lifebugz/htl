export type Blocker =
  'secret' | 'login' | 'physical' | 'payment_or_legal' | 'no_access'

export type Mode = 'now' | 'parallel'

export type Decision = 'accept' | 'reject' | 'handback'

export type SecretsMode = '1password' | 'none'

export interface HtlRequest {
  readonly title: string
  readonly steps: string
  readonly blocker: Blocker
  readonly why: string
  readonly tried: string
  readonly mode: Mode
  readonly check?: string
}

export interface HtlTask extends HtlRequest {
  readonly id: number
  readonly isArmed: boolean
}

export interface ClosedTask {
  readonly id: number
  readonly title: string
  readonly decision: Decision
}

export interface Terms {
  readonly tool: string
  readonly agent: string
  readonly command: string
  readonly askTool: string
  readonly host: string
  readonly shellPrefix: string
  readonly remote: string
}

export type Origin = 'user' | 'remote' | 'self' | 'automation'
