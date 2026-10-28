# Data menu review

## October 28, 2026 — Inline export/import menu

Status: approved locally, published, and deployed October 28, 2026. [PR #36](https://github.com/vibe-coding-milan/am-i-going-broke/pull/36), release `f1cc73a68722fb502c1797d3749bca4b45d1131d`. Live owner acceptance remains pending in [issue #11](https://github.com/vibe-coding-milan/am-i-going-broke/issues/11).

Approved design replaces section headings, icons, and explanatory paragraphs with five text actions: Export to file, Import from file…, Export to Google Drive, Import from Google Drive…, and Start over…. Only the destructive action has a divider. Known Drive backup time and relevant operation feedback remain visible. Appearance now stays outside Data in the header. Wide screens show the three theme choices in a pill-shaped group; at 860px and below a separate Appearance pill opens Device / Dark / Light choices, with the saved preference marked. Both popovers are mutually exclusive, close on outside click or Escape, and return focus appropriately. Theme selections apply immediately and persist. Resizing closes the compact Appearance popup and moves focus out of hidden content. The owner approved this responsive refinement for publication after local review.

Desktop pointer rows are 32px in a 280px panel. Narrow layouts (up to 860px) and devices with any coarse pointer use 44px rows in a panel up to 300px. Width is bounded by viewport gutters; short screens scroll internally. Light mode uses a darker red for readable destructive text.

Validation: syntax and 68 local link checks; 33 regressions in each of two time zones (66 passes). Browser review covered 1280px desktop, 768px tablet, and 320px phone layouts in light/dark themes. Measured action heights: 32px desktop, 44px tablet/phone; no horizontal overflow at 320px or 768px. A 568×320 landscape viewport bounds the panel and allows internal scrolling. Verified actual file export and import preview with the exported empty test plan, replacement warning, cancellation focus return, Start over confirmation/cancel, and Escape dismissal. Reload retained the selected theme. Existing tests cover backup compatibility and Drive operation cleanup/retry.

Limits: no real Google authorization or transfer performed; physical touch devices and screen readers remain unverified. Live verification confirmed exact source matches for index.html, app.js, and styles.css, plus HTTP 200 for the homepage and policy pages. Browser checks on production confirmed the five labels, separate Appearance controls, 44px rows and no overflow at 320px, mutually exclusive popovers, light-theme selection and focus return. Production deployment retained backups of replaced files.

### Owner review checklist

- [ ] Review spacing and labels on desktop in both themes.
- [ ] Review separate Appearance pill, selection, and resizing between compact/wide layouts; check phone/tablet tapping and short-screen scrolling.
- [ ] Confirm file export/import and Google Drive actions with a disposable test plan.
- [ ] Confirm Start over remains separated and requires confirmation.

## October 17, 2026 — Previous simplification

Status: implemented after user approval. The original audit and proposed scope are retained below.

## Observed steps

1. Desktop Data menu at 1280 × 900: functional and grouped, but 512px tall with repeated action descriptions and connection-state terminology.
2. Mobile Data menu at 393 × 852: 614px tall including appearance controls, covering most of the available page. The bounded scroll container remains useful for short screens.
3. Start over confirmation: clearly describes clearing this browser's plan while keeping downloaded/Drive backups. Download backup first, Cancel, and Clear plan are available. Inspected and cancelled without clearing data; focus was reported at the page root afterwards, so return focus to the initiating control in implementation.

Fresh screenshots are saved in the session's mobile-refresh/data-menu-audit artifact directory as 01-desktop.png, 02-mobile.png, and 03-confirmation.png.

## Proposed menu

- One quiet line: Saved in this browser. Remove the redundant Your data heading.
- Backup file: Download backup; Restore backup…
- Google Drive (Manual backup): Back up; Restore…
- Show the last successful backup time only when known. Show progress, success, and errors when relevant.
- Separated Start over… action, with the existing confirmation and download-first safeguard.
- Compact mobile Appearance footer: Device / Dark / Light.

Use consistent outline icons with short visible labels. Keep 44px action targets; remove duplicated small-print descriptions and excessive section spacing. Retain direct access to all four backup/restore actions rather than adding nested menus or collapsing essential actions.

## Drive connection simplification

The code's driveRequest calls ensureDriveAccess, which requests authorization if no access token exists. A 401 clears the token and retries authorization once. Both backup and restore already use this path, so a separate Connect Drive action is unnecessary in the primary menu. Remove Drive linked, Ready for backup, and Reconnects when needed from the normal presentation. Reauthorization remains available through the action being attempted, with explicit errors and retry when needed.

No Google authorization or actual backup/restore transfer was performed in this audit. Remembered connection and expired-token states were inspected in source, not visually reproduced.

## Guidance

- Nielsen Norman Group, Icon Usability: pair icons with visible text labels, especially on touch interfaces. https://www.nngroup.com/articles/icon-usability/
- GOV.UK Design System, Details: optional explanation can be disclosed when needed; do not hide information most users need. https://design-system.service.gov.uk/components/details/

These principles support simplifying secondary explanation while leaving the actual backup and restore actions visible. Any optional About backups disclosure should contain help only, never essential actions or current errors.

## Implementation guardrails

Preserve backup format, Google Drive scope and storage behavior, restore previews, explicit destructive confirmation, keyboard focus, visible errors, and light/dark styling. Target a materially shorter menu without smaller touch targets. Verify disconnected, remembered-link, authorization retry/cancel, busy, success/error, and mobile/desktop states during implementation. Actual physical-device and assistive-technology validation remain pending.

## Implementation and verification

- Four backup/restore actions and Start over remain visible with consistent outline icons and 44px targets. Secondary descriptions and the standalone connection button are removed; known backup times and relevant progress/errors remain.
- Measured default menu height: approximately 337px desktop and 422px mobile, compared with 512px and 614px in the audit. The landscape menu stays bounded and internally scrollable. No horizontal overflow at phone widths.
- Confirmed a local sample-plan download, restore preview, and actual restore round trip. Lowest and ending balances, rule count, and schedule bounds are unchanged. Start over was cancelled without clearing data; focus returned to its control.
- Simulated tests cover authorization on demand, a single expired-token retry, permission recovery on a later user retry, and duplicate-operation prevention with control cleanup.
- All 21 tests pass in each of America/New_York and Pacific/Auckland. Source/link and whitespace checks pass. Light and dark themes were inspected.
- Actual Google OAuth/transfers, remembered-token states in a real Google session, physical mobile browsers, and screen readers remain unverified. Google Drive scope, file format, and data persistence are unchanged.
