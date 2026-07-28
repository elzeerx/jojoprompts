# Dependency Risk Register

Last reviewed: 2026-07-28

## Current audit state

- `npm audit --omit=dev`: 0 critical, 0 high, 2 moderate.
- Full `npm audit`: 0 critical, 7 high, 5 moderate, 1 low.
- The full-audit high findings are confined to local build/lint tooling
  (`eslint`, Tailwind/Sucrase, glob/minimatch/brace-expansion). They are not
  installed by a production-only install.
- `@lovable.dev/mcp-js` and `tailwindcss-animate` are build-time dependencies
  and are therefore declared in `devDependencies`.

## Temporary React Router exception

The production-only findings are the npm advisories affecting
`react-router-dom@6.30.4` / `react-router@6.30.4`:

- Open redirect through backslash URL normalization.
- SSR hydration error deserialization.

The current controls are:

- JojoPrompts is a client-rendered Vite SPA. It does not use React Router SSR,
  hydration data, React Server Components, or `deserializeErrors`.
- Untrusted post-auth `next` destinations pass through
  `src/lib/v2/safeNext.ts`, which rejects schemes, protocol-relative values,
  backslashes, control characters, whitespace smuggling, auth loops, and
  unsafe nested destinations.
- The safe-next behavior has hostile-input regression tests.
- V2 resource slugs are server-validated as lowercase kebab-case before they
  can be used in public links.
- Remaining V2 and admin navigation destinations are fixed internal routes or
  internal paths assembled from server-validated UUIDs/slugs.
- React Router's `v7_startTransition` and `v7_relativeSplatPath`
  compatibility flags are enabled and covered by route regression tests to
  reduce the later major-upgrade surface.

The exception is temporary because npm's available fix is the React Router 7
major upgrade. That upgrade must be completed and regression-tested as its own
pre-launch hardening item; it must not be applied with an automated
`npm audit fix --force`.

## Required re-check

Before removing the Coming Soon launch lock:

1. Run `npm audit --omit=dev`.
2. Check the latest React Router release and advisories.
3. Upgrade to a non-vulnerable release if it no longer introduces a higher
   severity advisory for the V2 runtime.
4. Re-run all route, auth-next, checkout-return/cancel, admin, build, and
   browser smoke tests.
