# Mobile web UX audit — October 16, 2026

Status: historical audit and proposed scope. No app behavior changed during the audit itself. The subsequent implementation is tracked in [Mobile refresh](MOBILE_REFRESH.md).

## Conclusion

The current phone layout preserves access to the desktop features, but gives almost every desktop element a separate vertical row. The result fits the viewport while making forecasting, editing, and scanning transactions unnecessarily laborious. A deliberate mobile presentation is warranted, while preserving the chart's financial meaning and the desktop workflow.

The refresh should prioritize: a compact header; a useful forecast summary before configuration; a readable, touch-inspectable chart; compact payment summaries with editing on demand; and a much denser transaction list. Theme behavior does not currently justify a functional change: the user retried it on the Pixel and reported that it was working.

## Scope, evidence, and limits

- Reviewed the current checked-out HTML, CSS, chart generation, theme selection, and rule/ledger rendering.
- Captured fresh local screenshots with fictional built-in sample data, on an isolated browser origin. No real plan or external backup was modified.
- Viewports: 1280px desktop baseline; 393 × 760 and 360 × 640 portrait proxies; 760 × 393 landscape. These are CSS viewports, not physical Pixel 6a screenshots or an exact reproduction of its display/font settings.
- Inspected 30- and 90-day charts, payment fields, transaction cards, Light/Dark/System choices, and utilities.
- Captures use the in-app browser. Actual Firefox Android, Chrome Android, and Safari iOS execution, virtual keyboards, native date pickers, browser-toolbar collapse, OS theme changes, font scaling, screen readers, and real-device performance remain unverified. Do not describe this audit as a cross-browser certification.
- Screenshots and the illustrated report are saved with the chat's mobile-audit artifacts; filenames are listed below. This portable repository record intentionally does not contain machine-specific artifact paths.

## 1. Desktop baseline — retain the strengths

Evidence: `01-desktop-baseline.png`.

The wide chart, full-period overview, visible high/low annotations, threshold/average options, grouped rules, and tabular ledger are useful. Retain those on desktop. The status area has room for clearer numerical context, but the mobile refresh should not force desktop into a narrow column, replace its table with phone cards, or hide its inline editing tools.

Guardrails: preserve desktop chart width, controls, table comparisons, keyboard focus, and theme behavior. Keep one projection engine and state model across layouts.

## 2. Phone landing screen — high-priority hierarchy and alignment issue

Evidence: `02-mobile-90-top.png`, `11-small-phone.png`.

At 393px, the logo starts about 38px below the title's top. The phone CSS centers it against the complete title/answer/description block rather than the heading. This confirms the reported misalignment. The handwritten answer uses platform-dependent cursive fallback fonts, making its mobile appearance less predictable; that is a code-derived portability risk, not a reproduced Firefox font defect.

The chart begins around y=522px in both tested portrait layouts. At 360 × 640, most of the chart is below the initial viewport. A separate utility row, status block, stacked Cash/Window fields, large Run button, and repeated supporting copy take precedence over the actual answer. There is no horizontal page overflow at these portrait widths; vertical task ordering is the larger problem.

Recommendation: one compact logo/title row aligned directly to the heading, with utilities in a clearly labeled menu. Omit the animated handwritten answer on phones, as the user is willing to do; preserve a meaningful forecast answer in the main summary instead. Keep desktop's current brand treatment. Show a concise status explanation, lowest balance/date, and ending balance. Make balance/date editing compact and secondary. The forecast period should remain easy to change; cosmetic theme choices need not occupy a separate permanent row.

Source: header/mobile rules in [styles.css](../styles.css), handwritten styling in [projection-answer.css](../styles/projection-answer.css), and [index.html](../index.html).

## 3. Charts at 30 and 90 days — preserve the visualization, improve access to its values

Evidence: `02-mobile-90-top.png`, `03-mobile-30-chart.png`.

The current line, threshold guides, average, and high/low markers remain useful. At 393px, the SVG is about 343px wide, and its 62px left/12px right gutters leave about 269px for the actual plotted timeline. Ninety daily points then have only about 3px per interval. Nested page/panel spacing makes this tighter.

More consequentially, compact mode explicitly suppresses numeric high/low annotations while leaving the markers and checked High/low control. Both 30- and 90-day phone charts use only start/middle/end date ticks. There is no point inspector or touch/keyboard interaction. Even in the less dense 30-day case, users cannot read a minimum's exact amount/date without finding it elsewhere in the ledger.

Recommendations:

1. Retain the full-period overview, current calculation semantics, average and cushion options, and visual threshold language. Avoid making horizontal scrolling the only way to see the entire forecast.
2. Reclaim nested padding selectively and measure label gutters instead of relying on one fixed compact margin. Keep labels legible rather than making all text smaller.
3. Show lowest balance/date and ending balance in HTML adjacent to the chart, independent of whether SVG annotations fit.
4. Add tap/drag inspection with a persistent date, balance, and applicable payment details. Provide equivalent keyboard access and a textual alternative; dragging must not be the only way to inspect data. Preserve ordinary vertical page scrolling.
5. If detail zoom is added, distinguish it from the forecast period. Changing 90 days to 30 currently changes the projection horizon and potentially its status; it is not merely a visual zoom. Keep the selected 90-day summary authoritative while inspecting a smaller slice.
6. Put display layers and cushion editing in a secondary Chart options disclosure on phones, retaining discoverability and the existing options on desktop.

Source: `renderProjectionChart`, compact annotations, date ticks, and SVG rendering in [app.js](../app.js).

## 4. Payment editing — too many permanently expanded fields

Evidence: `04-mobile-editor.png`.

The four sample rules occupy roughly 2,530 vertical pixels at 393px. Each rule is a complete editor with repeated labels, controls, actions, start/end dates, and explanatory copy. Multiple borders/shadows add visual weight without improving comparison. Amount fields retain a fixed 12rem width even when their surrounding phone card is full width. The new start/end capability should remain fully available, but does not need to be displayed on every rule at once.

Recommendation: compact rows showing name, signed amount, next payment or cadence, and any payment bounds/exclusion state. Open one editor at a time. Keep payment-date guidance inside that editor, with the bounds intact. Prefer a disclosure or a page-sized accessible editor over a small nested modal. Preserve current automatic updates if using disclosures, and show saved/error feedback near the edited field. If a draft editor is chosen later, define Save/Cancel behavior explicitly before implementation. Return focus and scroll context to the edited row when closing it.

Group add actions into a clear Add income/Add expense control area; reduce the prominent Hide button's competition with the primary task. Keep existing desktop inline fields and shortcuts.

Accessibility strengths: sample amount and date fields compute to 16px, and major add/remove actions have substantial hit areas. Native keyboard/date-picker usability still needs actual-device testing.

## 5. Transaction scanning — repeated labels overwhelm useful data

Evidence: `05-mobile-ledger.png`.

The 90-day sample page is roughly 10,845px tall; the ledger alone occupies about 6,643px. Each transaction card repeats Date, Name, Money in, Money out, Balance, and Scenario, including the unused money-direction row. The sample screenshot shows about two transactions per 760px viewport. On same-day continuation rows, the desktop renderer omits the date; that grouping convention becomes confusing when rows are separate mobile cards.

Recommendation: one compact transaction presentation with date, name, a signed amount, and running balance. Repeat dates on standalone mobile entries or make date grouping explicit. Expand details and occurrence exclusion on demand. Start with a bounded number of rows plus Show more or date grouping, maintaining access to every item and consistent chart totals. Preserve the desktop table.

A labeled Forecast / Payments / Transactions section switcher could make the phone experience easier to navigate without forcing repeated scrolling. Use progressive enhancement and retain ordinary links/sections as a fallback. Bottom navigation is optional; if chosen, account for safe areas and the virtual keyboard rather than covering the editor.

Source: transaction rendering in [app.js](../app.js), block-table conversion below 860px in [styles.css](../styles.css).

## 6. Themes — no confirmed functional defect

Evidence: `06-mobile-light.png`, `07-mobile-system.png`; user follow-up in this chat.

Observed in this audit: explicit Light selected/resolved light; explicit Dark selected/resolved dark; System selected/resolved dark while the browser reported a dark preference. The user independently retried the Pixel and said it was working. This does not establish how its original transient state arose.

The app uses `prefers-color-scheme`, with modern and legacy change listeners; it does not calculate sunset or use time-of-day scheduling. This media feature represents a browser/OS preference, rather than a clock. See [MDN's preference definition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme). Firefox Android exposes Light, Dark, and Follow device theme in its customization settings; see [Mozilla's Android theme guidance](https://support.mozilla.org/en-US/kb/using-dark-theme-firefox-android).

Recommendation: use labeled Light / Dark / Device choices in a mobile appearance menu and show the resolved mode, for example Device · Dark. Retain explicit overrides. Test OS-mode changes while open, background/resume, reload persistence, and switching back from an override. Rechecking media state on page resume is a possible hardening measure if a stale state is reproduced; it is not a proven fix for the user's report. Do not silently redefine System to mean sunset scheduling.

Theme buttons measure 34 × 34px and chart toggles 30px high; help is 28px high. Increase effective mobile touch areas toward a comfortable 44px target without adding another tall toolbar. These are usability recommendations, not a blanket accessibility-conformance failure.

## 7. Data and utilities — usable in portrait, secondary to forecasting

Evidence: `08-mobile-data.png`.

The menu is clearly grouped and the destructive action is visually separated. It occupies a substantial overlay over the forecast. Combining utilities into a labeled mobile menu can reclaim the permanent header row. Preserve backup/restore discoverability and confirmation behavior, and keep dangerous actions separate. Do not remove controls to save space.

## 8. Landscape and limited-height views — menu containment needs work

Evidence: `09-landscape.png`, `10-landscape-data.png`.

At 760 × 393, the header and forecast inputs consume almost all of the initial viewport. The open data panel starts near y=189 and extends to about y=640. Its CSS uses overflow hidden with no viewport-relative height limit or internal vertical scrolling. Lower actions require scrolling the page; the panel is not contained within the available height. This is not evidence that those actions are permanently unreachable.

Recommendation: let the forecast/chart become the main landscape content. Constrain mobile utility/editor surfaces to available viewport height with internal scrolling and an obvious close affordance. Check dynamic browser chrome and keyboard-induced viewport changes on actual devices. Apply safe-area padding where new fixed surfaces require it; the existing absence of safe-area CSS is not itself proof of a current defect.

## Proposed implementation sequence

1. **Phone header and hierarchy:** align logo/title, remove the handwritten mobile sub-answer, consolidate utilities, and add concise forecast numbers. Preserve the desktop brand header and controls.
2. **Chart usability:** preserve the overview, reclaim plot width, expose exact values and dates, and add accessible touch inspection. Keep forecast horizon distinct from any detail zoom.
3. **Payments and ledger:** compact summaries, editing on demand, dense transaction rows, explicit same-day grouping, and quick section navigation.
4. **Browser hardening:** touch targets, constrained overlays, keyboard/focus handling, theme lifecycle tests, and real-browser acceptance checks.

This sequence is a proposed scope, not a completed implementation or promised release date. Visual selection can follow the evidence before changing the interface.

## Acceptance guardrails for the eventual refresh

| Area | Required check |
| --- | --- |
| Priority devices/browsers | Physical Pixel 6a Firefox first; Chrome Android; Safari iOS. Record actual browser/OS versions. Edge and Opera are not primary targets. |
| Small/large phone layouts | 320–430 CSS px, portrait/landscape, browser bars expanded/collapsed, and larger system text. No hidden actions or page-width overflow. |
| Core flow | Open saved plan, change period, inspect a low balance, add/edit income and expenses, set contract payment bounds, exclude/restore an occurrence, and reload. |
| Chart invariants | Same daily values, dates, threshold/average settings, low/end balances, and full-period visibility as the baseline. Touch detail must not change the forecast horizon or totals. |
| Keyboard/native controls | Focused fields stay visible with keyboard open; decimal/date input works; closing an editor restores context. No mandatory hover-only affordances. |
| Themes | Explicit Light/Dark and Device work, persist, and respect OS/browser changes on resume. No time-based assumptions. |
| Desktop | Compare 1024/1280/1440 widths in both themes using the same fixtures; retain wide chart, inline editing, table, keyboard access, and all existing capabilities. |
| Data safety | Scheduling tests in both time zones, old-plan normalization, JSON round trip, save/error handling, and manual Drive flows when authorized. Layout changes must not reset or migrate financial values unnecessarily. |
| Accessibility | Reading order, meaningful labels, focus continuity, text contrast, enlarged text/zoom, reduced motion, and equivalent non-drag chart inspection. |

No source refactor or projection-engine replacement is required to establish this mobile presentation. Browser and device acceptance is part of completion, not something to infer from responsive screenshots alone.
