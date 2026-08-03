# Dependency Risk Register

Last reviewed: 2026-08-03

## Current audit state

- Registry-backed audits were refreshed again on 2026-08-01 during the
  Admin V2 workspace-consolidation deployment pass.
- `npm audit --omit=dev`: 0 critical, 2 high package nodes, 0 moderate,
  0 low. Both nodes (`react-router` and direct `react-router-dom`) represent
  one underlying advisory, GHSA-qwww-vcr4-c8h2.
- Full `npm audit`: 0 critical, 3 high, 3 moderate, 1 low.
- `react-router-dom` is pinned exactly to `7.18.1` so a future install cannot
  silently move the release candidate to an unreviewed router build.
- The registry still reports `7.18.2` as latest stable; it remains in the
  advisory range. No stable `8.3.0` package is available.
- A fresh non-test source scan still finds no `react-router/rsc`,
  `react-router-dom/server`, `createStaticRouter`, `createRequestHandler`,
  `useActionData`, `useFetcher`, or `ScrollRestoration` path.
- `@lovable.dev/mcp-js` and all lint/build packages remain
  `devDependencies`; they are not part of a production-only frontend install.

## React Router 7.18.1 exception

The remaining production advisory is:

- **GHSA-qwww-vcr4-c8h2** — CSRF bypass in unstable React Server Components
  action handling, affecting `react-router >=7.12.0 <8.3.0`.

The upstream advisory explicitly states that an application is affected only
when it uses the unstable RSC APIs. JojoPrompts is a client-rendered Vite SPA:

- It does not import `react-router/rsc`.
- A fresh source scan also found no `react-router-dom/server`,
  `createStaticRouter`, `createRequestHandler`, `useActionData`, `useFetcher`,
  or `ScrollRestoration` path.
- It has no React Router server runtime, RSC routes, server actions, framework
  action handlers, SSR hydration payloads, or `ScrollRestoration`.
- Commerce and admin mutations call authenticated Supabase RPCs/Edge
  Functions; they are not React Router actions.
- Untrusted post-auth destinations pass through `src/lib/v2/safeNext.ts`,
  which rejects schemes, protocol-relative values, backslashes, control
  characters, whitespace smuggling, auth loops, and unsafe nested targets.

This is therefore a non-applicable runtime path in the current architecture,
not an ignored reachable defect.

### Why 7.11.0 was rejected

On 2026-07-29, npm suggested `react-router-dom@7.11.0` because it predates
the new RSC advisory. A controlled local downgrade and audit was performed,
then reverted: 7.11.0 reintroduced multiple older advisories covering normal
SPA navigation, open redirects/XSS, route-matching denial of service, SSR,
and RSC code. Keeping 7.18.1 has the smaller and non-reachable exposure.

The upstream patched React Router release is listed as 8.3.0. The npm registry
currently reports `react-router-dom@7.18.2` as the latest stable release, and
it remains inside the advisory's affected range. `react-router-dom@8.3.0` was
not published at refresh time. Do not force an unpublished, nightly,
experimental, or git dependency into the release.

## Development-only findings

The full audit adds:

- High: ESLint's nested `brace-expansion` dependency chain. It runs only in
  trusted local/CI lint workflows; production-only audit excludes it.
- Moderate: `@lovable.dev/mcp-js` →
  `@modelcontextprotocol/sdk` → `@hono/node-server` Windows-only static-file
  traversal. The generated MCP endpoint runs on Supabase's Deno Edge runtime,
  not the Hono Windows Node static-file adapter.
- Low: the MCP toolchain's nested esbuild Windows development-server issue.
  JojoPrompts does not expose that development server in production.

Do not apply `npm audit fix --force`; its proposed major tooling changes can
change the build and lint contract. Upgrade those chains when their direct
packages publish compatible fixes, followed by the complete local suite.

## Required re-check before removing Coming Soon

1. Run `npm audit --omit=dev` and full `npm audit`.
2. Check whether a stable patched `react-router-dom` has been published.
3. If available, upgrade in an isolated change and rerun route, `safeNext`,
   auth, checkout return/cancel, admin, full source, build, and rendered
   browser tests.
4. If no compatible patched package exists, reconfirm that no RSC/server
   imports or router actions were introduced and keep this exception current.

## Interim non-closing refresh — 2026-08-01 19:23 UTC

Refreshed inside the superseding controlled stability window that started at
2026-08-01 17:01:34 UTC, with earliest close 2026-08-02 17:01:34 UTC and
`PUBLIC_LAUNCH_LOCK` still `true`. Baselines: frontend
`50c841bb57a02ab81c68984f515a5cc86df10566` (containing verified absolute-lock
ancestor `6f6d1c9060db1a6eb1554ffa0c679d51cefb093e`), database migration
`20260801170134_harden_legacy_transaction_and_discount_writes`, and Edge
Function `v2-admin-integrations-settings-status` version 15.

- `npm audit --omit=dev`: 0 critical, 2 high.
- Full `npm audit`: 0 critical, 3 high, 3 moderate, 1 low.
- The React Router RSC advisory remains architecture-unreachable. A fresh
  source scan again found no RSC, server-router, or action path.
- `react-router-dom` remains pinned to `7.18.1`. The registry's latest stable
  is `7.18.2`, which is still inside the advisory range, and no stable `8.3.0`
  is published.
- `bun run verify:v2` passed typecheck, scoped lint, 989 tests, and the
  production build.

This refresh is clean, but it is **non-closing evidence only**. It does not
close the stability gate and must be rerun after 2026-08-02 17:01:34 UTC. Any
runtime source, migration, Edge Function, payment/scanner configuration, or
launch-lock change restarts the window; documentation-only synchronization does
not. The pre-launch re-check list above still applies.

## Close-out audit refresh — 2026-08-03 06:10 UTC

Close-out began 2026-08-03 06:10 UTC, after the 2026-08-02 17:01:34 UTC
earliest-close time. `PUBLIC_LAUNCH_LOCK` remains `true`; nothing was published
or deployed and no runtime, test, migration, function, package, or
configuration file changed. Baselines: frontend `50c841bb` (absolute-lock
ancestor `6f6d1c90`; the `3e4a5cf7` preview head was not published), database
migration `20260801170134_harden_legacy_transaction_and_discount_writes`, and
Edge Function `v2-admin-integrations-settings-status` version 15 (deployed
2026-07-31 23:26:45 UTC, before this window).

- `npm audit --omit=dev`: 0 critical, 2 high — unchanged.
- Full `npm audit`: 0 critical, 3 high, 3 moderate, 1 low — unchanged.
- The npm latest stable `react-router-dom` remains `7.18.2`, still inside the
  advisory range; `react-router-dom` stays pinned to `7.18.1` and no stable
  `8.3.0` is published.
- A fresh source scan again found no RSC, server-router, action, or
  `ScrollRestoration` path, so GHSA-qwww-vcr4-c8h2 remains
  architecture-unreachable.
- `bun run verify:v2` passed typecheck, scoped lint, 996 tests, and the
  production build.

Dependency risk is therefore unchanged and carries no new blocker. The release
is nonetheless **blocked** by a separate operational defect: at 2026-08-02
13:55:21 UTC password recovery returned 500 because Resend rejected the message
(`noreply.jojoprompts.com` is not a verified sending domain). The sender domain
must be verified or replaced and a controlled recovery-email retest must pass
with clean Auth and delivery logs. Owner/legal acceptance remains pending under
operational owner Nawaf Alsuwaiyed, and separate public-launch approval must
not be requested until the email blocker is cleared.
