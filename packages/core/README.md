# packages/core

The htl logic every harness shares: reading and checking a task request, the
tool's description and input schema, the `/htl` arguments, every text the agent
reads, the toasts, replies and status lines the user reads, and the steps that
change the task lists. A harness registers the tool and the command, draws the
pane, keeps the state and sends the answer; core turns plain values into plain
values. The pane's own labels and the command's description live in the
harness.

## Rules

- **Edit only here.** Each harness gets a generated copy (for Claude Code:
  `harnesses/claude-code/hooks/core/`). After a change, run `bun run core:sync`
  from the repository root and commit the source and its copy together.
  `bun run core:check` fails when they differ.
- **Only its own files.** `src/` imports nothing but relative paths: no
  package, no `claude-code`, no `node:` module. ESLint enforces it.
- **No I/O.** No process, file, clock, pane or prompt calls. `tsconfig.json`
  loads no host types, so `process` or `Bun` does not type-check in `src/`.
- **No harness words.** A text that names a harness thing (the tool's full
  name, the command, the agent, the question tool, the shell prefix, the remote
  client) takes it from a `Terms` value the harness passes in. A prompt's
  sender arrives as a neutral `Origin`: `user`, `remote`, `self` or
  `automation`.
- **Fresh arrays out.** The state steps take readonly lists and return new
  ones. So a harness can pass a step straight to a state update, which may run
  it twice: it tries again when another write got there first.
- **A public API.** A harness imports only `src/index.ts`.

## Modules

| Module            | What it holds                                                               |
| :---------------- | :-------------------------------------------------------------------------- |
| `src/types.ts`    | The shared types: `HtlRequest`, `HtlTask`, `ClosedTask`, `Terms`, `Origin`… |
| `src/guards.ts`   | Shape checks, and `unreachable` for a value no case covers                  |
| `src/request.ts`  | Reads a tool call's input into a request, or lists what is wrong            |
| `src/validate.ts` | Refuses a request: too many open tasks, a repeat, the 1Password checks      |
| `src/tool.ts`     | The tool's name, description and input schema                               |
| `src/command.ts`  | The `/htl` arguments                                                        |
| `src/origin.ts`   | Which senders answer tasks, and which are remote                            |
| `src/text.ts`     | Every other text: results, refusals, toasts, replies, labels                |
| `src/cards.ts`    | Which card the pane shows, the next card, and the card header               |
| `src/state.ts`    | New tasks, lifting the gate, committing and rolling back an answer          |
| `src/index.ts`    | The public API                                                              |

Inside `src/`, only `index.ts` imports `text`, `cards` and `state`.

## The shared types

A Claude Code plugin's `types/index.d.ts` must be self-contained: the plugin
validator refuses an `import` in it. So it repeats seven of the shapes in
`src/types.ts`. `harnesses/claude-code/tests/state.test.ts` fails to
type-check when a copy and its source differ in any way, a dropped `readonly`
or `?` included.

## Test

`bun test` from the repository root runs `tests/*.test.ts`: one file each for
`cards`, `command`, `origin`, `request`, `state`, `text` and `validate`, and
`terms.test.ts`, which checks the tool's texts and every other text with
another harness's terms: none of them may name Claude Code. `tests/helpers.ts` holds the shared requests,
and `OTHER`, a set of terms that names no harness.
