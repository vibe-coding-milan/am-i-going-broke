# Shared application and platform boundaries

This is preparation for future mobile/desktop packaging, tracked in [#54](https://github.com/vibe-coding-milan/am-i-going-broke/issues/54). The deployed product remains a web app. Native projects, plugins, authentication changes, offline caching and a framework migration are outside this change.

## Module responsibilities

| Module | Responsibility |
| --- | --- |
| `forecastCore.js` | Local-calendar arithmetic, scheduling, limits, stable calculation order, ledger rows, daily chart points and payment-field validation. No storage, DOM or network access. |
| `planData.js` | Default state, normalization, legacy imports, version-3 backup serialization and filenames. The caller supplies calendar helpers and ID creation; defaults retain their existing meaning. |
| `planRepository.js` | Synchronous plan loading/saving, legacy storage keys and reliable financial-edit timestamps. Storage errors propagate to the existing app warning; unreadable loads retain the existing empty-draft fallback. |
| `browserPlatform.js` | Lazy local/session storage adapters, browser file handoff, authorization navigation and foreground/connectivity subscriptions. |
| `driveServiceClient.js` | Same-origin endpoint validation, cookie/CSRF-protected HTTP requests, timeouts, error mapping and Google authorization-destination validation. |
| `driveSync.js` | Existing account-bound durable queue, shared-base/revision checks, conflicts, debounce and retries. Its engine contract is unchanged. |
| `driveSyncUI.js` / `app.js` | Existing dialog, input, chart, focus and rendering behavior; connect the shared modules to browser adapters. |

The small inline theme bootstrap still reads the existing theme key before paint to avoid a theme flash. Response-rotation session storage remains presentation-only. Neither is a second financial-plan store.

## Data compatibility

- Keep `cash-flow-projector-state` and the v1/v2/v3 legacy lookup keys. Version-3 local backups still contain `version`, `exportedAt` and `data`; the ordinary saved envelope also retains optional `planSavedAt`.
- Local drafts may contain incomplete schedules; upload validation intentionally rejects them. Preserve the distinction between empty drafts, edited fictional examples and personal plans, including confirmed zero-dollar balances.
- Financial fingerprints still come from `DriveSync.planData`. Presentation, example-origin and save/export metadata do not become cloud financial fields. Cosmetic saves do not relabel a meaningful edit, and missing legacy edit timestamps remain unknown.
- Payment date strings are local calendar dates. Export/save times are instants; do not convert payment dates to UTC midnight. Inclusive bounds, count origins, individual exclusions and `calculationOrder` retain their existing semantics.
- `tests/fixtures/plan-compatibility.json` contains fictional results captured before extraction. JavaScript checks normalized state, ledger rows, daily points and backup envelopes. Shared valid/invalid sync cases run against both JavaScript and PHP validators.

## Frontend package

Run `npm run build:web` to recreate ignored `dist/` from an explicit frontend file/asset allowlist. The command needs Node.js 24 and no dependency installation. It copies existing files without bundling, rewriting HTML or changing their contents. Do not edit generated output.

`dist/` contains `index.html`, the current policies, scripts, styles and assets. It excludes PHP, private configuration, tests, documentation and operational backups. Current website publication still uses the guarded DreamHost script, now including all required shared modules. Creating the package does not deploy it.

The package is a structural starting point, not a standalone native or fully offline app: fonts are still external, and the existing Drive endpoint is relative to its website origin. A local static preview needs an unavailable/mock service; it cannot execute PHP. Browser checks use fictional data and simulated service responses in isolated contexts.

## Future adapter requirements

The current backend deliberately requires the website origin, secure HTTP-only session cookies, CSRF protection, account identity and the fixed Google callback. Changing a configured URL is insufficient for native authorization. Design a native system-browser return/session mechanism separately; do not loosen current checks or include secrets in native assets.

The plan repository and sync queue currently acknowledge synchronous storage. An asynchronous native store needs initialization and durable-write acknowledgement/failure handling before use; do not substitute unawaited plugin writes. Preserve account ownership, per-instance outboxes and recovery data during any later migration.

Installed app releases can lag behind the website/server. Before adding a protocol field or changing its meaning, preserve the existing response shape (`accountId`, opaque `revision`, `savedAt`, `plan`), expected-revision checks and operation-ID deduplication; define an explicit supported-client/version policy and fixtures. Do not repurpose missing/null fields or discard unknown financial fields silently. Native session changes require a separately tested compatibility boundary.

Foreground checks remain throttled; meaningful edits retain five-second inactivity and thirty-second maximum wait, draft gating and retry deadlines. No background-sync guarantee is introduced.

## Verification and release

Run `npm run check`. Calculation, persistence, response and example regressions are organized into separate suites; direct shared-module tests no longer extract their source text. Remaining page/dialog harnesses bridge only UI code. PHP 8.2+ server checks are required in CI even when unavailable locally.

The refactor is compared with baseline commit `09ef509986e5f06bc6f5aab16e9ef570421cae20`. Publication, deployment, live asset verification and owner/device acceptance are distinct milestones. Keep actual-device and real multi-account results in [#25](https://github.com/vibe-coding-milan/am-i-going-broke/issues/25) and [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40), with remaining preparation acceptance in #54.

Recorded local checks: 175 JavaScript test executions passed, including 53 calculation/application/compatibility tests in each of two time zones. The frontend package contained 24 files and reproduced byte-for-byte. Old/new isolated Chromium contexts matched summary, ledger, payment and banner contents across 19 states at both 1280px and 320px. Checks included all eight examples, horizon changes, personal input, persistence, JSON download, import cancellation and Drive settings. Simulated authenticated sync adopted a fictional plan without uploading defaults, committed one edit with exactly one delayed write, retained it through reload and paused without another write in both versions. No page script errors or horizontal overflow were observed. This is browser/fixture evidence, not physical-device or real-account certification. PHP is unavailable locally; its required CI results and publication are recorded in #54.
