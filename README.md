# JojoPrompts V2

JojoPrompts V2 is a mobile-first marketplace and permanent personal library
for Jojo-owned AI resources:

- Skills
- Automations and workflows
- Prompts and prompt packs
- Image styles
- Bundles

The commercial model is one-time payment only. Customers can acquire
individual resources or unlock the full Jojo library for 30.000 KWD. Eligible
settled purchases count toward that lifetime threshold.

## Release status

The V2 public launch remains intentionally locked by
`src/config/siteMode.ts`. Production visitors see Coming Soon while admins and
Lovable preview hosts can validate the new application.

Do not disable `PUBLIC_LAUNCH_LOCK`, publish the Lovable project, apply
production migrations, or deploy Edge Functions as a side effect of ordinary
development. Follow `docs/V2_RELEASE_READINESS.md` and obtain explicit release
approval.

## V2 surfaces

### Customer

- Public discovery for skills, automations, prompts, image styles, and bundles
- Resource details with platform compatibility, installation guidance,
  permissions, files, versions, license, and scan state
- Cart and UPayments one-time checkout in authoritative KWD/fils
- Permanent entitlements, lifetime progress, receipts, and signed downloads
- English/Arabic content with RTL-aware layouts

### Admin

- Dedicated Admin V2 shell and role-protected navigation
- Unified resource publisher and publishing queues
- Catalog, versions, imports, taxonomy, package scans, and activity history
- Orders, payment events, refunds, recovery, entitlements, and discounts
- Users, transactional templates, delivery health, security events, and
  integration settings

Creators, commissions, KYC, and payouts are intentionally excluded from V2.0.

## Stack

- Vite, React 18, TypeScript
- Tailwind CSS and shadcn/Radix components
- Supabase Auth, Postgres/RLS, private Storage, and Edge Functions
- UPayments for one-time KNET/card/Apple Pay checkout
- Cloudmersive for uploaded package malware scanning
- OpenAI-powered admin publishing utilities
- Lovable for project preview and publication

## Local setup

Prerequisites:

- Bun 1.3 or compatible
- Access to the linked Lovable/Supabase project for integrated backend work

Install and run:

```bash
bun install
bun run dev
```

Never commit Supabase service-role credentials, UPayments tokens,
Cloudmersive keys, or OpenAI keys. Runtime secrets belong in Supabase Edge
Function Secrets.

## Verification

Run the release-oriented local gate:

```bash
bun run verify:v2
```

It performs:

1. TypeScript type checking.
2. ESLint against active V2/customer/admin sources.
3. The complete `src` Bun test suite.
4. A production Vite build.

The repository still contains archival V1 modules that are deliberately
unreachable from `src/config/routes.ts` and the Admin V2 registry. The broad
legacy `bun run lint` command reports historical issues in those archived
files; `bun run lint:v2` is the release gate for active code. Retirement
contracts ensure archived callers cannot invoke retired production endpoints.

Before launch, also run:

```bash
npm audit --omit=dev
npm audit
```

Review the documented, architecture-specific exceptions in
`docs/security/DEPENDENCY_RISK_REGISTER.md`; do not use
`npm audit fix --force`.

## Backend model

Primary V2 entities include:

- `resources`, `resource_versions`, `resource_files`
- compatibility, installation, permission, license, and scan records
- `products`, bundles, carts, orders, order items, payment events, refunds
- `entitlements` and `lifetime_credit_entries`
- reports and activity/security events

Prices are server-authoritative integer fils. Downloads require a valid
entitlement and are delivered through short-lived signed URLs. Payment and
scan workers are idempotent and fail closed.

## Deployment

The production site is `jojoprompts.com`, backed by Supabase project
`fxkqgjakbyrxkmevkglv` and the Lovable project documented in the release
readiness file.

Deployment order matters:

1. Verify backups and rollback evidence.
2. Apply reviewed database migrations in timestamp order.
3. Deploy the exact reviewed Edge Function bundle.
4. Fetch deployed function sources/hashes and run backend smoke checks.
5. Sync/publish the frontend while Coming Soon remains enabled.
6. Complete preview and production-locked QA.
7. Disable Coming Soon only under a separate final launch approval.

Historical PayPal records remain read-only. PayPal and subscription flows are
not part of V2 checkout.
