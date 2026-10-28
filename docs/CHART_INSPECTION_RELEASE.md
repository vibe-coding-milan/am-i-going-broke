# Chart inspection release — October 28, 2026

Status: live at [amigoingbroke.me](https://amigoingbroke.me/), October 28, 2026.

## Behavior

Desktop inspection snaps to the nearest date horizontally. The highlighted point and vertical guide identify the selected balance. A compact date/balance card chooses among four nearby placements, penalizes overlap with balance segments and labels, stays inside visible bounds, and prefers its existing side when practical. Cramped views fall back to the external readout.

Narrow plots (under 560 CSS pixels) and touch/pen input use a reserved detail strip below the plot. Tap selects and persists; horizontal movement locks into scrubbing after a directional threshold. Vertical scrolling remains native through touch-action: pan-y and pointer cancellation. Previous/Next controls provide exact single-day selection; Close and outside interaction dismiss inspection. A mouse on a wide hybrid device resumes floating placement.

Payment names are omitted from the card. Full payment details remain in Transactions. Arrow keys, Home/End and Escape remain available; deliberate selections have a polite announcement while hover changes do not flood the live region. Focus returns to the chart before hiding its controls.

## Verification

- Six automated interaction regressions cover date selection and bounds, visible card bounds, hybrid tablet input, persistent touch selection, horizontal capture, vertical cancellation, keyboard navigation, focus restoration and live-region behavior.
- Full local project checks passed: syntax and 87 local links, six chart interaction regressions, 56 Drive/UI regressions, and 37 scheduling/application regressions in each of two time zones (136 JavaScript test runs). PHP is unavailable locally; GitHub CI must pass server lint and tests before website deployment.
- In-app browser checks passed at 1280px desktop, 820px tablet, and 393px/320px phone widths: moving pointer selection, first/last-date placement, Home/End and Escape, Previous/Next and Close, focus restoration, no horizontal overflow, and an external phone readout below the plot. All three phone controls are at least 44px tall.
- Test screenshots are kept in ignored local evidence. No personal data or local deployment configuration is included in source publication.
- An isolated native Firefox desktop check confirmed rendering, point-relative placement, Home navigation and one-day arrow navigation with fictional data. Physical Pixel 6a touch, owner MacBook Air acceptance, and screen-reader checks remain separate; viewport checks and simulated pointer events do not establish physical touch acceptance.

## Publication

- [PR #51](https://github.com/vibe-coding-milan/am-i-going-broke/pull/51) merged as [39a8da7](https://github.com/vibe-coding-milan/am-i-going-broke/commit/39a8da7ef6a2b99ca560d8752eb982cda5dfce61). The merged source tree exactly matched the locally tested tree.
- [GitHub CI passed](https://github.com/vibe-coding-milan/am-i-going-broke/actions/runs/40787439359), including required PHP server lint/tests and all 136 JavaScript regression runs.
- The configured deployment preview and release replaced exactly app.js, index.html and styles.css; existing private backup behavior was retained.
- HTTPS verification returned HTTP 200 and exact byte matches for all three changed files. Homepage, privacy and terms checks succeeded.
- Live browser verification passed desktop point-relative placement and endpoint navigation, plus the 393px external readout, single-day controls, Close/focus restoration and no horizontal overflow. Light live and dark local layouts were inspected.
- Versioned app/style URLs ensure an ordinary refresh requests the new assets. No saved plan data or sync configuration was changed by this release.
