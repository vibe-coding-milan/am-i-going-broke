# Changelog

## 2026-10-28 — Unify Google Drive around automatic sync

- Replace the browser-only connection and manual Drive transfer controls with one server-backed Connect action. Connecting enables automatic sync; local file download/import remain independent.
- Show the account, actual sync status, one pause/resume toggle and the Am I Going Broke? folder. Keep disconnect and contextual recovery secondary. Remove the misleading last-backup indicator.
- During connection, copy a legacy cloud plan into a separate current sync file inside the app folder without modifying the original. Continue protecting empty devices and genuinely competing edits.
- Retire the public manual Drive backup routes, old browser OAuth code and obsolete transfer tests. Update privacy disclosures for the single server-backed flow.
- Published in [PR #44](https://github.com/vibe-coding-milan/am-i-going-broke/pull/44), release e07cbab, deployed and activated with private credentials outside the site. Real Google authorization, offline token renewal, folder/current-file metadata and saved-plan readability passed; the owner reported Up to date. No credentials or financial contents are in the release record.
- Verification: 108 retained JavaScript regression runs, 61 isolated PHP assertions, and responsive mock connection/automatic-write checks. Private configuration is provisioned; actual authorization and refresh verification are recorded separately in the [release log](docs/DRIVE_SYNC_RELEASE.md).

## 2026-10-28 — Read Drive before saving and simplify plan choices

- Make Google Drive… the entry point on ordinary visits. Connecting checks for an existing plan first and makes no Drive writes; an empty session can pick it up directly. Different populated plans show two short summaries, the Drive save date, and two choices.
- Collapse advanced controls under More options and remove redundant confirmation steps. Keep ordinary confirmations calm; reserve danger treatment for destructive actions. Preserve all system theme choices and responsive dialog sizing.
- Replace the old manual overwrite path with separate timestamped snapshots. Block empty/example/unfinished saves, skip identical copies, recheck plans before replacing local data, and keep one local recovery slot. Older copies remain discoverable.
- Let automatic setup discover a previous manual backup as a versioned baseline, preserving that file when a separate current sync file is created.
- Published in [PR #42](https://github.com/vibe-coding-milan/am-i-going-broke/pull/42), release 54fa83f, and deployed with byte-matched live app files. The local recovery safeguard is also deployed in [PR #43](https://github.com/vibe-coding-milan/am-i-going-broke/pull/43), release 037798d. Local recovery remains available after Google is disconnected; automatic-sync configuration remains pending.
- Validation: 126 JavaScript regression runs and 57 isolated PHP assertions; browser tests covered returning/empty sessions, comparison/recovery, stale choices and responsive/enlarged text. No real Google files were changed during those tests. See [release record](docs/DRIVE_SYNC_RELEASE.md).

## 2026-10-28 — Publish production-URL sync preview and simplify error dialogs

- Add an explicit `?drive-sync=preview` entry on the production origin, retaining it through the fixed OAuth callback. Ordinary visitors retain manual Drive controls until general activation.
- Replace alarming generic error dialogs with concise titles, plain guidance, and one OK action. Cancelled/blocked Google sign-in, missing backups, expired permission, failed downloads, and invalid imports get specific messages; raw Google errors stay out of app dialogs. Destructive confirmations retain their warnings.
- Validation: 116 JavaScript regression runs; final PHP lint and 49 isolated service assertions; cancellation dialogs checked at desktop/tablet/phone/landscape widths without overflow.
- Published in [PR #41](https://github.com/vibe-coding-milan/am-i-going-broke/pull/41), release bed88ba; deployed and verified against the live public files. The service reports unavailable until private OAuth setup is completed.
- Publication/deployment/configuration status: [production preview release record](docs/DRIVE_SYNC_RELEASE.md). Real Google OAuth configuration and cross-device owner acceptance remain separate gates; see [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40).

## 2026-10-28 — Build optional automatic Drive sync behind an inactive flag

- Add account-bound debounced syncing, durable per-tab pending state, conflict choices, offline/reconnect handling, and bounded recovery. Keep immediate local saving and manual downloads.
- Present Google Drive sync as the primary connection in a four-action Data menu; keep manual Drive snapshots and recovery secondary. Add first-time, older-backup, returning-device, expired-session, and account-change guidance.
- Check Drive on device/page return, including a trailing check after rapid returns. Expose both resolved conflict candidates through recovery.
- Keep confirmation dialogs returning to their originating settings/menu, and wrap mobile navigation/chart labels under enlarged text without changing theme tokens.
- Add a default-off optional interface with connected account, last successful sync, folder/recovery controls, and cross-device reset/restore warnings. Place mobile status below the header to preserve the existing layout.
- Add a disabled-by-default PHP authorization/Drive service with encrypted credentials, PKCE/state/CSRF protections, account locks, version checks, one working file, timestamped manual snapshots, and legacy-backup discovery.
- Prepare accurate privacy disclosures and guarded deployment inclusion. Details, test evidence, and activation gates: [Drive sync implementation](docs/DRIVE_SYNC.md).
- Validation: 114 JavaScript regression runs; PHP lint and 49 isolated service assertions with simulated Google requests; enabled-preview and feature-off browser checks across desktop/tablet/phone/landscape layouts.
- Local development only: not published, deployed, authorized with real Google credentials, or enabled for users. Public endpoint flag remains empty.

## 2026-10-28 — Keep dialog text inside its controls

- Replace the compressed confirmation-button row with a two-column action grid and a full-width backup action. Wrap long labels and error text; constrain dialogs to the viewport and allow vertical scrolling.
- Refresh shared stylesheet URLs across the app and policy pages.
- Checked backup-update, reset, invalid-import, restore-preview, and simulated long-error dialogs across desktop, tablet, phone, and short landscape layouts; inspected both themes and enlarged text. Details and limitations: [Dialog review](docs/DIALOG_REVIEW.md).
- Published via [PR #39](https://github.com/vibe-coding-milan/am-i-going-broke/pull/39), release `bc3c902`, and deployed October 28, 2026. The four deployed files exactly match merged source. Live desktop and 320px phone reset-dialog checks passed, including cancellation/focus return. Owner/device acceptance remains in [issue #38](https://github.com/vibe-coding-milan/am-i-going-broke/issues/38).

## 2026-10-28 — Clarify privacy policy for Google Drive verification

- Identify the developer and app domain, and describe the exact Drive permission, backup contents, file metadata, and manual export/import purposes.
- Explain direct browser-to-Google transfers, local storage, in-memory tokens, HTTPS protection, sharing limits, and the absence of advertising or AI training uses of Google user data.
- Clarify retention and separate instructions for clearing local data, deleting Drive/downloaded backups, and revoking Google access.
- Validation: source review against current backup behavior and Google's privacy policy guidance; syntax/link checks and 66 scheduling regressions passed.
- Published via [PR #37](https://github.com/vibe-coding-milan/am-i-going-broke/pull/37), release `368ed5d`, and deployed October 28, 2026. Deployment preview and upload changed only privacy.html and preserved a server backup. The live policy exactly matches the merged source; homepage, privacy, and terms returned successful HTTP responses. Google verification, domain ownership, and non-owner Drive testing remain pending in [issue #12](https://github.com/vibe-coding-milan/am-i-going-broke/issues/12).

## 2026-10-28 — Compact Data menu and separate Appearance controls

- Use inline Export/Import labels for files and Google Drive; remove section headings, icons, and explanatory copy.
- Use compact desktop rows and larger targets for narrow screens and touch-capable devices.
- Keep Appearance separate from Data, using a wide pill-shaped group and a compact Appearance pill/dropdown on narrow screens. Preserve saved Device/Light/Dark preferences and keyboard dismissal.
- Retain the last Drive backup time, operation feedback, restore previews, and the separate Start over confirmation.
- Validation: syntax/link checks and 66 regression runs; browser checks across desktop, tablet, phone, and short-screen layouts in both themes, including theme persistence and keyboard dismissal.
- Published and deployed October 28, 2026 via [PR #36](https://github.com/vibe-coding-milan/am-i-going-broke/pull/36), release `f1cc73a`. The live HTML, JavaScript, and CSS match the approved source; phone layout and theme selection were checked on production. Live owner acceptance remains tracked in [issue #11](https://github.com/vibe-coding-milan/am-i-going-broke/issues/11).

## 2026-10-18 — Payment usability and local backup reliability

- Clearly label fictional example projections, retain an example banner after reload, and provide a confirmed path to start a personal plan.
- Use one first payment date for new biweekly items, explain weekly/monthly timing, and preview upcoming dates. Preserve existing optional eligibility limits and count anchors.
- Leave optional dates blank. Incomplete required schedules are visibly pending and contribute nothing until completed; existing intentional dates remain intact.
- Expire removal Undo after later edits/additions, exclusions, reordering, or forecast refresh; add Dismiss and retain immediate recovery.
- Add same-section manual movement through Move up/down controls and a dedicated pointer/hold drag handle. Save arrangement without changing same-day calculation order.
- Keep excluded items and their scheduled transactions visible with matching labels and muted treatments. Preserve individual skipped occurrences when re-enabling an item.
- Use explicit Included/Excluded transaction controls, consistent Payments naming, clearer bulk-inclusion wording, and an opening balance separate from incoming payments.
- Preserve editing focus and visual position through rerenders. Keep local download feedback visible, delay Blob URL cleanup, handle detectable failures, and use matching UTC timestamps (including milliseconds) in filenames and payloads; restore previews show the timezone.
- Validation: 33 regressions in each of two time zones (66 passes), syntax/documentation checks, 320px/412px/1440px browser review, reorder persistence and desktop dragging, Undo lifecycle, and a JSON download/restore round trip.
- Release prepared for production publication. Physical Pixel 7/Android Chrome, assistive-technology, and blocker-specific validation remain tracked in GitHub issues #25 and #34; no blocker or network cause is claimed.
- Details and screenshots: [Usability release](docs/USABILITY_RELEASE.md).

## 2026-10-17 — Expanded forecast answers

- Activated 93 reconciled responses across the five existing forecast statuses and existing no-data/below-zero handling. Removed overlapping jokes and lines requiring new trend or expense categories.
- Rotate through every matching response before repeating, remembering each pool across reloads in the same tab when session storage is available. Forecast edits refresh the answer; cosmetic renders do not.
- Preserved below-zero priority, reduced motion, interrupted-animation handling, and completed-answer announcements. Forecast calculations and saved plans are unchanged.
- Validation: source/link checks and 26 regressions in each of two time zones. Source publication and live deployment are verified separately during release.

## 2026-10-17 — Simpler forecast header

- Focused the header on lowest balance/date, Cash today, and Forecast period. Removed the repeated heading, status badge, net change/duration, and visible Update forecast button.
- Kept concise dated warnings for below-zero balances or reaching the red cushion. The headline still uses the existing financial classifications.
- Cash edits and period selection continue to update automatically; Enter can reconfirm unchanged cash for today. Validation, saved plans, and calculations are preserved.
- Desktop uses one aligned row; mobile shows the low point above two always-visible inputs, replacing the repeated collapsed settings summary.
- Validation: 22 regressions in each of two time zones (44 passes), including low/date, empty-state, red-cushion and below-zero warning coverage; browser checks for cash validation, Enter, automatic period updates, persistence, light/dark themes, and 320px/393px/1280px layouts.

## 2026-10-17 — Quiet chart toggles

- Removed the below-chart confirmation banners for Average, High/low, and Cushions visibility changes. The toggles and chart remain the immediate feedback; settings still persist.
- Other notifications, including validation and backup feedback, are unchanged.

## 2026-10-17 — Connected cushion controls

- Removed visible checkmarks from the three chart toggles while preserving native keyboard and screen-reader operation, full control hit areas, and checked/off styling.
- Centered the desktop toolbar and grouped Cushions with its three compact target fields inside one shared container. On phones, the Cushions control connects visually to the target row, with Average and High/low aligned alongside it.
- Retained one visibility toggle for all three targets, independent amount editing, validation, and saved values.

## 2026-10-17 — Aligned chart options

- Placed Average, High/low, and Cushions directly beside one another with identical visible checkbox-toggle styling and aligned 52px controls, including clear off and keyboard-focus states.
- Followed the toggles with the existing tinted two-line Red/Yellow/Green amount fields, reduced to 112px widths on desktop and aligned with the toggle controls. Removed the help icon/tooltip.
- Fixed the cushion checkbox hit area extending beyond its visible control. Fields remain editable independently of visibility; invalid ordering retains its existing validation and alignment.
- Wrapped the controls into two aligned rows on narrow screens. Financial calculations, target persistence, and backup format are unchanged.
- Review history and verification: [Chart options](docs/CHART_OPTIONS_REVIEW.md).

## 2026-10-17 — Simpler forecast and footer copy

- Removed the balance-confirmation reminder and forecast/date explanation beneath the starting-cash controls.
- Shortened the footer credit to “Vibe coded by Milan Mijatovic.” Contact, privacy, and terms links remain available.
- Forecast calculations, date metadata, backup compatibility, and saved plans are unchanged.

## 2026-10-17 — Compact Data menu

- Reduced the menu to four clearly labeled backup/restore actions and a separated Start over action; removed repeated helper text and the separate Drive connection/status row.
- Kept local file and manual Google Drive backups directly accessible, standardized outline icons, retained 44px action targets, and compacted the mobile Appearance footer.
- Drive actions authorize when needed and show progress while preventing duplicate operations. Expired-token retry remains bounded; insufficient-permission errors clear the cached token so the next user attempt can authorize again.
- Kept known backup timestamps, visible errors, restore previews, download-first safeguards, and destructive confirmations. Cancelling a dialog restores menu focus; Escape closes the menu.
- Validation: 21 regression tests in each of two time zones (42 runs), source/link checks, local download/preview/restore round trip, reset cancellation focus, light/dark review, and phone/landscape/desktop checks. Menu height fell from about 512px to 337px on desktop and 614px to 422px on mobile, without shrinking action targets.
- Actual Google authorization/transfers and physical-device/screen-reader checks remain pending. See [menu review and implementation notes](docs/DATA_MENU_REVIEW.md).

## 2026-10-17 — Headline typography, colors, and response variety

- Matched the response to the question's font, weight, and responsive size. Question and answer share normal inline wrapping; the hidden untyped suffix reserves space without reducing the answer's typography.
- Colored affirmative zero-crossing answers coral/red and negative answers purple (dark theme) or blue (light theme). Thinking dots remain neutral; the text still explicitly answers the question.
- Replaced “Cushion loading” with “Your balance is building.”
- Randomize within the current forecast scenario on page loads, valid forecast edits, and explicit Update forecast actions, avoiding the immediately previous phrase when alternatives exist. Cosmetic updates do not replay or reshuffle the answer.
- Retained the thinking delay, typing speed, reduced-motion support, and complete-answer announcements. Financial calculations, categories, and saved plan format are unchanged.

## 2026-10-17 — Thinking and typed forecast responses

- Added 16 approved cheeky responses matched to forecast health; a projected zero crossing takes priority over cushion categories.
- Added a one-second thinking ellipsis and typing at 40 milliseconds per character on populated page loads and valid forecast edits. Calculations remain immediate; unfinished responses are cancelled when a newer forecast arrives.
- Keep the same phrase within a health category for the session. Theme, chart-layer, collapse, and viewport changes do not restart the response.
- Aligned question and answer on one baseline when space permits, with the answer wrapping below the question on mobile. Reserve the final text's space to avoid movement while typing and remove the underline.
- Honor reduced-motion preferences, including preference changes during playback; announce only complete responses to assistive technology.
- Validation: 18 regression tests in each of two time zones, source/link checks, and responsive browser review. See [response notes](docs/FORECAST_RESPONSES.md).

## 2026-10-17 — Forecast refinement

- Replaced the visible inspection slider and previous/next controls with chart hover/tap inspection, a compact chart readout, and keyboard navigation (arrows, Home/End, Escape).
- Kept the lowest balance and its date prominent; made net change secondary and moved ending-balance inspection onto the chart.
- Removed the balance date selector and restored today-based forecasting. Preserved the saved balance and its confirmation date, with a reminder when cash needs updating; retained original payment/count anchors and backup compatibility.
- Simplified the header to “Nope.” / “Yep.” for the entered forecast's zero crossing, with a one-time typing reveal and reduced-motion support. Kept the existing forecast categories and removed the introductory paragraph.
- Grouped the cushion switch with its target fields, refined narrow transaction alignment, shortened pagination to “Show more” with a separate count, and corrected section highlighting while scrolling long ledgers.
- Validation: 16 regression tests in each of two time zones, syntax/link checks, and local desktop/phone inspection. Physical-device checks remain pending.
- Supersedes the slider, ending-balance summary, balance-date selector, and header treatment documented in the initial mobile refresh below. See [refinement notes](docs/REFINEMENT_REVIEW.md).

## Review history — Initial mobile forecast refresh

- Added a compact mobile header, labeled section navigation, exact lowest/ending balance summaries, and collapsible balance/chart settings. The handwritten sub-answer remains on desktop and is hidden on phones/tablets.
- Preserved the full-period chart, average/cushion layers, and wide desktop layout. Added chart tapping, a date slider, previous/next-day controls, and date/balance/payment inspection without changing the forecast horizon.
- Added compact mobile payment summaries with one editor at a time, automatic saving, payment bounds, and a Done control. Desktop keeps inline editing.
- Added dense mobile transaction rows, dates on each entry, progressive disclosure after 20 rows, descriptive occurrence controls, an exclusion count, and restore-all. Desktop retains its table and all rows.
- Added Undo for payment removal, retained invalid input drafts until corrected, and avoided rebuilding unchanged editors on ordinary field blur.
- Added an explicit balance-as-of date; changing cash no longer silently restarts the forecast from today. Negative starting cash remains supported.
- Moved labeled Device/Dark/Light choices into the mobile Data menu, added resume-time preference rechecks, larger touch targets, and viewport-contained menus.
- Added visible local-save failures, backup shape/version validation, restore previews with rule count/balance/date, and a download-current-backup action in confirmation dialogs.
- Made threshold equality consistent with red-zone coloring and prevented safe low points or dangerous high points from receiving misleading marker colors.
- Added policy section navigation, return/cross-links, and factual privacy copy for externally loaded fonts and readable JSON backups.
- Kept the existing version-3 state envelope, storage key, payment engine, and start/end-date behavior. No dependency or framework was added.
- Validation: 14 regressions in each of two time zones, project syntax/link checks, and local browser checks at phone, landscape, and desktop widths. Real Firefox Android / Chrome Android / Safari iOS checks remain pending.
- Implementation and review notes: [Mobile refresh](docs/MOBILE_REFRESH.md). This entry records local/review-branch work, not a production deployment.


## 2026-10-16 — Mobile UX audit (documentation only)

- Recorded a focused mobile audit in `docs/MOBILE_UX_AUDIT.md`, including header alignment, forecast hierarchy, 30/90-day chart readability, payment-editor density, transaction scanning, touch targets, and limited-height utility menus.
- Captured fresh desktop/phone/landscape evidence using fictional sample data in an isolated local browser origin.
- Defined a proposed mobile improvement sequence and explicit desktop, chart/data, accessibility, and Firefox Android / Chrome Android / Safari iOS acceptance guardrails.
- Theme choices worked in the audit session, and the user reported that the Pixel issue no longer reproduced. Kept the original report as unconfirmed; no theme behavior changed.
- No application code, production deployment, or real financial plan changed in this audit. Physical-device/browser validation remains pending.

## Unreleased — Repository housekeeping

- Retired four unused full/text logo variants and the completed implementation plan from the current GitHub tree. Local copies remain ignored for optional manual deletion; `docs/CLEANUP.md` records the inventory and rationale. Active icons and OAuth consent assets are retained. Existing Git history is preserved.
- Recorded the verified private DreamHost history backup in the maintenance notes.
- Added an explicit rights-reserved notice for the publicly inspectable, proprietary project. No open-source reuse license is granted; GitHub platform rights and third-party terms remain applicable.
- Rewrote the README around the live app, data handling, current functionality, local setup, checks, deployment, and ownership. Removed outdated spreadsheet context and already-completed roadmap items.
- Added solo-maintainer feedback guidelines, private security reporting, bug/suggestion templates, and maintenance/recovery notes.
- Added automatic project checks for pushes and pull requests, including source/shell syntax, local documentation and HTML link targets, and scheduling regressions in two time zones. These checks do not deploy or access DreamHost credentials.
- Standardized CI and deployment on Ubuntu 24.04 and Node.js 24, with actions pinned by SHA and weekly Dependabot update proposals.
- Added editor/line-ending conventions and additional private-key/history-bundle exclusions. Updated the original implementation plan to record the completed production deployment.
- These are repository and operations changes; they do not change the app's behavior or deploy a new website version.

## 2026-10-16 — GitHub publication, domain links, and first DreamHost deployment

- Connected the local project to `vibe-coding-milan/am-i-going-broke`, retaining the existing GitHub initial commit. Original local development history remains on `codex/preserved-local-history`.
- Published the app, replaced machine-specific README links, documented the production domain, and added canonical URLs to the homepage and policy pages.
- Added the manual DreamHost workflow, authenticated previews, a public-file upload allowlist, strict server host-key verification, and backups of replaced website files.
- Successfully deployed commit `4e7aaa2` using DreamHost deployment #2 (record retained privately).
- Confirmed all 17 deployed public app files matched the local source after deployment. Syntax and 22 scheduling checks passed. Actual Google sign-in and Drive backup/restore were not exercised.

## 2026-10-16 — Payment start dates and scheduling reliability

### Added

- Optional payment start dates for recurring income and expenses, alongside existing end dates and occurrence limits.
- Plain-language payment-date guidance for contract/seasonal work. Date boundaries are inclusive; the selected weekday/monthly day/biweekly cadence still determines the actual payment dates.
- Inline validation for start/end ordering, invalid dates, negative or malformed amounts, monthly days, and occurrence limits.
- Regression tests in tests/scheduling.test.cjs and a scoped IMPROVEMENT_PLAN.md.

### Fixed

- Daylight-saving transitions duplicating calendar days, double-charging monthly payments, shifting biweekly cadence, and potentially trapping occurrence counting in a loop.
- Date keys now use local calendar dates consistently for ledger entries, chart points, and individual exclusions.
- Count-limited rules retain their payment-count start when the forecast is refreshed. Legacy count-limited plans anchor to their saved forecast start date during normalization.
- Adding income/expenses reveals the collapsed editor; its Hide/Show button exposes its expanded state to assistive technology.
- Cushion help no longer extends off the left edge of a phone viewport.
- Cushion target inputs fit the 320px phone layout without clipping the green target.

### Compatibility and scope

- Existing recurring rules without a start date retain their original schedule. The existing version-3 JSON envelope is retained; the new per-rule field is additive and included in local and Drive backups.
- One-time items keep using their exact payment date. Their hidden recurring boundaries do not change one-time behavior.
- Existing user edits were preserved. No financial plan was reset and no external backup was overwritten. This feature was subsequently deployed in the first DreamHost deployment recorded above.
- Broader audit recommendations are tracked as deferred in IMPROVEMENT_PLAN.md.

### Validation

- 11 scheduling/validation regression tests pass under America/New_York and Pacific/Auckland (22 passing checks total).
- JavaScript syntax check passes.
- Browser checks pass for the December 25 → January 15 contract gap, adding while collapsed, rejecting/correcting an end date before the start, rejecting/correcting a negative amount, and retaining both contracts' dates after reload.
- Date editors inspected at 1280px, 768px, 390px, and 320px. No horizontal page overflow at the tested phone/tablet widths. Tooltip and all three cushion targets fit at 320px.
- Screenshots saved outside the app source in the chat's payment-dates visualization folder. The review preview uses isolated demo data on port 8767.
- Google authorization and actual Drive backup/restore were not exercised; backup field preservation is covered by JSON normalization/round-trip regression tests.
- JavaScript syntax and git diff whitespace checks pass.
