# JojoPrompts V2 Performance Evidence — 2026-07-29

## Scope and environment

This evidence covers the public `/explore` route in a local production Vite
bundle using Lighthouse 13.4.1 and Google Chrome. The mobile run used
Lighthouse's default simulated mobile throttling; the desktop run used the
desktop preset. Temporary reports were written outside the repository.

The public production host remained behind Coming Soon. The private Lovable
preview was separately checked after sync on desktop and at 390x844.

## Retained optimization

- Split the lightweight Explore heading/SEO shell from catalog queries, cards,
  filters, lifetime status, and quick preview.
- Lazy-load the catalog body while preserving its loading skeleton.
- Preload the regular Forma brand font.
- Remove the unused GPT Engineer editor helper from production HTML.
- Anchor the visual-card title/price gradient to the image link so it no longer
  overlaps the version, update-date, and trust footer on mobile.

The final runtime change is commit `797fc7cf`, synced by Lovable at
2026-07-29 17:06:17 UTC.

## Lab comparison

| Profile | State | Score | FCP | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|
| Mobile | Before | 72 | 4.22s | 4.81s | 0 | 6ms |
| Mobile | Final | 79 | 2.43s | 4.81s | 0.00014 | 10ms |
| Desktop | Before | 99 | 0.66s | 0.90s | 0.00005 | 0ms |
| Desktop | Final | 99 | 0.51s | 0.95s | 0.00004 | 0ms |

The optimization materially improved mobile first contentful paint and kept
layout shift and main-thread blocking negligible. It did **not** bring the
mobile lab LCP below 2.5 seconds.

## Interpretation and release gate

- Desktop lab performance passes comfortably.
- Mobile CLS passes the `<0.1` target.
- Mobile lab responsiveness is healthy by TBT, but TBT is only a lab proxy.
- Lighthouse navigation mode does not prove field p75 INP.
- Mobile lab LCP remains above the target, so this document does not claim a
  Core Web Vitals pass.

The locked target remains field p75 LCP `<2.5s`, INP `<200ms`, and CLS `<0.1`.
Because the public site is intentionally locked, production field data for V2
does not exist yet. At launch, enable real-user monitoring for the public V2
routes and treat an out-of-target p75 trend as a ramp stop/rollback condition.

## Rendered QA

After Lovable synced `797fc7cf`, `/explore` was checked on desktop and 390x844:

- Explore heading, filters, 30-of-65 catalog state, and two-column visual
  masonry rendered.
- Arabic RTL and the signed-in lifetime state rendered correctly.
- Quick preview opened the selected resource without navigation.
- Visual-card metadata no longer overlaps the title/price gradient.
- No browser console warnings or errors were returned.
