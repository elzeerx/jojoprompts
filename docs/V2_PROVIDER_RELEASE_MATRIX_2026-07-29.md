# JojoPrompts V2 Provider Release Matrix — 2026-07-29

## Decision

The provider gate is accepted with mixed live and deterministic evidence. A
test is live when the provider sandbox safely supports it. A test is
deterministic when inducing it live would require malware, an artificial
provider outage, a forged provider response, or a provider capability that the
sandbox explicitly does not offer.

This decision does not weaken any fail-closed behavior and does not authorize
public launch.

## UPayments

| Scenario | Evidence | Result |
|---|---|---|
| Captured payment | Live sandbox, 0.900 KWD | Pass |
| Failed payment | Live sandbox attempts | Pass |
| Status recovery | Live sandbox status check after return | Pass |
| Cancelled payment | Exact terminal allowlist and status/webhook contract test | Pass |
| Duplicate/retried event | Deterministic external event IDs plus database uniqueness | Pass |
| Amount mismatch | Status/webhook rejection contract before settlement | Pass |
| Currency mismatch | KWD-only rejection contract before settlement | Pass |
| Identifier mismatch | Provider re-verification and merchant/track/provider-order checks | Pass |
| Refund submission | Live sandbox request | Pass |
| Processed refund | Sandbox returned HTTP 422 `work_in_production_only` | Provider unavailable |
| Refund failure safety | Failed submission preserved entitlement and lifetime credit | Pass |
| Refund pending/unknown | Non-revocation contract test | Pass |

UPayments does not permit a processed refund in its sandbox. The V2 release
therefore accepts the real 422 response together with deterministic
processed/failed/pending state contracts. The first production refund must be
treated as a monitored operational event, not as a launch prerequisite that
the sandbox cannot satisfy.

## Cloudmersive

| Scenario | Evidence | Result |
|---|---|---|
| Benign package | Live provider scan of uploaded QA package | Pass |
| Malicious/EICAR-equivalent | Shared response-mapping test | Pass |
| Contradictory clean + virus signal | Shared response-mapping test | Pass |
| Blocked macros/hidden risk | Shared response-mapping test | Pass |
| Malformed provider response | Shared response-mapping test | Pass |
| 408/429/5xx/network unavailable | HTTP classification test | Pass |
| Missing API/worker secret | Readiness fail-now test | Pass |
| Retry exhaustion | Bounded-attempt test | Pass |
| Mixed-file publication state | Aggregate fail-closed test | Pass |
| Stale clean coverage | Re-queue contract test | Pass |

No malware is uploaded to production storage, and no real provider outage is
induced. The deterministic tests import
`supabase/functions/_shared/scanProvider.ts`, the dependency-free decision
module used by the deployed scan worker.

## Canonical test files

- `src/lib/v2/scanProviderReleaseMatrix.test.ts`
- `src/lib/v2/upaymentsReleaseContract.test.ts`
- `supabase/functions/_shared/scanProvider_test.ts`
- `supabase/functions/_shared/v2Upayments_test.ts`

The Bun release tests run under `bun run verify:v2`. The larger Deno suites
remain the Edge Function-specific reference suites; Deno is not installed in
the release workstation, so the canonical launch gate does not claim a fresh
Deno execution.

## Residual operational watch

- Watch the first production refund end to end.
- Alert on UPayments verification rejection or reconciliation-required events.
- Alert on scan queue exhaustion, failed readiness, or any non-clean effective
  package state.
- Never manually grant entitlement from a browser return URL or unverified
  webhook payload.
