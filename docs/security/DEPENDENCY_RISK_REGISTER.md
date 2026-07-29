# Dependency Risk Register

Last reviewed: 2026-07-29

## Current audit state

- Registry-backed audits were refreshed on 2026-07-29 after the final local
  V2 verification. Counts and package paths were unchanged.
- `npm audit --omit=dev`: 0 critical, 2 high package nodes, 0 moderate,
  0 low. Both nodes (`react-router` and direct `react-router-dom`) represent
  one underlying advisory, GHSA-qwww-vcr4-c8h2.
- Full `npm audit`: 0 critical, 9 high, 3 moderate, 1 low.
- `react-router-dom` is pinned exactly to `7.18.1` so a future install cannot
  silently move the release candidate to an unreviewed router build.
- `@lovable.dev/mcp-js` and all lint/build packages remain
  `devDependencies`; they are not part of a production-only frontend install.

## React Router 7.18.1 exception

The remaining production advisory is:

- **GHSA-qwww-vcr4-c8h2** — CSRF bypass in unstable React Server Components
  action handling, affecting `react-router >=7.12.0 <8.3.0`.

The upstream advisory explicitly states that an application is affected only
when it uses the unstable RSC APIs. JojoPrompts is a client-rendered Vite SPA:

- It does not import `react-router/rsc`.
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

- High: ESLint/minimatch/brace-expansion and Tailwind/Sucrase/glob dependency
  chains. These run only in trusted local/CI build workflows.
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
