// GENERATED from packages/core - edit there, run `bun run core:sync`
export function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isOneOf<T extends string>(
  options: readonly T[],
  value: unknown,
): value is T {
  return options.some(option => option === value)
}

export function unreachable(value: never): never {
  throw new Error(`htl: unexpected value ${String(value)}`)
}
