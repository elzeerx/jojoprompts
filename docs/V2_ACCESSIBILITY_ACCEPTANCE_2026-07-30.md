# JojoPrompts V2 Accessibility Acceptance — 2026-07-30

## Result

Technical accessibility acceptance passes against the synced Lovable preview
for runtime head `d397c76f`. This evidence completes the release gate for
zoom, reduced motion, keyboard focus, landmarks, accessible names, responsive
reflow, and Arabic RTL behavior. It does not replace future user research or
ongoing accessibility monitoring.

## Environment

- Preview:
  `https://id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app`
- Runtime: `d397c76f`
- Browser: Chrome 150 on macOS
- Surfaces: public Explore in English and Arabic; authenticated Admin Overview

## Evidence

### 200% browser zoom and responsive reflow

- Chrome's browser zoom was set to exactly 200%.
- English Explore rendered at an effective viewport width of 665 px.
  `documentElement.clientWidth` and `scrollWidth` were both 658 px, so the page
  introduced no horizontal content overflow.
- Arabic Explore rendered with `lang="ar"`, `dir="rtl"`, and the Arabic
  `استكشف` H1. `clientWidth` and `scrollWidth` were both 658 px.
- Both languages switched to the responsive header, menu, filter, and card
  presentation without clipped controls or hover-only actions.
- The zoom setting was restored after the check.

### Reduced motion

- Chrome DevTools emulated
  `prefers-reduced-motion: reduce`.
- The live page confirmed
  `matchMedia("(prefers-reduced-motion: reduce)").matches === true`.
- The Arabic RTL Explore page retained its H1, main landmark, responsive
  controls, and content reflow.
- Computed animation and transition durations across the sampled rendered
  elements were reduced to `0.00001s`; no active animation name remained.
- The emulated viewport had no content overflow beyond its inner width.

### Keyboard, landmarks, and accessible names

- Admin Overview exposed exactly one non-nested `main` landmark, an H1 named
  `Overview`, named navigation and regions, and named interactive controls.
- Tabbing from the document moved focus to `Skip to admin content`.
- The focused skip link was visibly rendered at 172.328 by 44 px with white
  text on charcoal and a white-plus-gold focus ring.
- The skip link has a real in-page target and the destination is focusable.
- The synced Admin Overview, Publisher, Orders, Payment Events, Entitlements,
  Refunds, Recovery, Discounts, and Transactional Templates routes expose one
  `main`, no nested `main`, named primary controls, and no page-level
  horizontal overflow.
- The 200% English and Arabic Explore checks found zero unnamed interactive
  controls.

## Release interpretation

The technical accessibility gate is complete. Public launch still requires the
independent stability, dependency/advisor, owner/legal, operational-owner, and
separate launch-approval gates documented in `V2_RELEASE_READINESS.md`.
