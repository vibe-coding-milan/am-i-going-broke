# Data menu review — October 17, 2026

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
