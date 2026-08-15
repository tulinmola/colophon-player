# Colophon Player — agent instructions

Colophon Player is where Colophon is read: the emulator carried into a page as a web component, and in time a debugger. The machine itself lives in the sibling repository `colophon-emulator`, under its own instructions; read those before touching anything that crosses into C. Read `README.md` for the prologue.

## Voice

- The register is a scribe's: plain, declarative, a little antique. Take the manuscript metaphor completely seriously and never wink at it — pointing at the bit kills it.
- Like an illuminated manuscript: mood at the openings, discipline in the middles. A section's first sentence may sing; commands, specs, and rules stay dry.
- Humor only as a byproduct of honesty. None in code comments or error messages: comments pay rent in facts, and error messages are read on bad days.
- Write for 2036. Mood is timeless, jokes are timestamps; the prose meets the same bar as the code.

## Writing style

- One paragraph, one line: markdown is never hard-wrapped. Soft wrap does the work.
- Sources are cited at their point of use, in the code or doc that uses them: link, what we learned, what we changed. No link dumps.

## Build and test

- `npm start` runs the site, `npm run build` writes `dist/`.
- `npm run check` is Prettier, ESLint and the tests together; run it before handing work back.
- Never commit, never push. The human reviews; the human commits.

## Code style

- Prettier decides formatting and is never a discussion: `npm run prettier:write`, `npm run prettier:check` to verify. ESLint decides the rest: `npm run lint`.
- Avoid defensive guards that hide implementation errors; only add checks when the condition can legitimately occur at runtime.
- Use modern class features: prefer private fields/methods (`#`) for internal helpers and state, keep `on*` handlers public when they are called externally (events/lifecycle).
- When multiple `const` values are tightly coupled, group them into a single declaration using commas (avoid moving unrelated declarations to the top of a function).
- Prefer `function` over arrow functions (`=>`) when it is semantically a vanilla function. In those cases, only use arrow functions when it ends with much shorter one-line code.
- Avoid cryptic shortened variable/function names.
- Avoid passing a call's result directly as an argument; hoist it to a named `const` first (including the argument to `super(...)`).
- Prefer self-documenting code over comments. Add a comment only when its absence would likely make a future editor introduce a bug (a non-obvious invariant, footgun, or external constraint). Explaining what the code does, or why an approach was chosen, does not qualify — that belongs in the commit message.
- Avoid adding non-needed `.js` extension in imports.
- Prefer `==` over `===`. Use strict comparison (`===`) only when strictly needed.
- Prefer `for...of` for plain value iteration.
- Use indexed `for` when index arithmetic, multi-cursor updates, in-loop mutation control, or coupled temporal variables are needed.
- Avoid `.forEach`.

## Naming

- The emulator's names are the machine's names, and they survive the crossing: what the Compendium and the datasheets call a thing is what it is called here too.
- Wrappers around the WASM module mirror the C API mechanically, in the host language's case: `cpc_tick` becomes `tick` on the machine object, `keyboard_press` becomes `pressKey`. A wrapper that renames what it wraps hides the emulator from anyone reading both.

## Simplicity And Ownership

- Keep behavior the same.
- Do not rewrite code unless explicitly requested or required to complete the task.
- When a rewrite/refactor is requested, prefer a clean rewrite over incremental patching if the final behavior is unchanged.
- Less code is better when semantics are equivalent.
- Avoid generic abstractions for app-specific workflows.
- Components should handle UI/events only; loading, fetching and the WASM module belong to dedicated modules.
- Keep APIs app-owned and explicit (use domain terms, not generic helpers).
- Avoid controller logic inside view components.
- Do a final cleanup pass: remove redundant checks, temporary indirections, and duplicated logic.
- If two options work, choose the one with fewer concepts and fewer lines.
