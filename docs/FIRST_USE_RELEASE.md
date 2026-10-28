# First-use experience release — October 28, 2026

Status: live at [amigoingbroke.me](https://amigoingbroke.me/), October 28, 2026.

## Scope

Publish the owner-approved first-use experience: one introductory example action, eight editable fictional checking-cash stories with individual cushion targets, narrative banner and cycle, clean personal setup, disabled example/empty downloads, and safe Drive retrieval from introductory mode. Keep existing personal plans, header voice, Data layout and sync revision protections.

[Implemented behavior](FIRST_TIME_EXPERIENCE_PROPOSAL.md) · [Changelog](../CHANGELOG.md) · [App](https://amigoingbroke.me/)

## Evidence before publication

- The owner reviewed the local experience on a MacBook Air M1 and explicitly approved production publication.
- 130 JavaScript regression runs passed: 56 Drive/UI checks plus 37 scheduling/application checks in America/New_York and Pacific/Auckland.
- A final release run exposed a collision in random example payment IDs. Example IDs now use their scenario-local index; a controlled repeated-clock/random regression verifies uniqueness without changing personal IDs.
- Outcome checks cover ordinary/leap-year month boundaries, all six forecast horizons, eight distinct ordered cushion sets, finite benefits and repair payments, personal zero-dollar input and example origin persistence.
- Browser checks covered desktop and 320px/390px phones, light/dark states, the full example cycle, story/horizon persistence, personal entry, reset, disabled downloads and focus continuity.
- Simulated Drive checks retrieved both populated and zero-dollar personal plans with zero example uploads. Existing sequential-device, stale revision, conflict and offline regression coverage passes.
- No personal financial data, credentials or ignored development fixtures/screenshots are included in this release.

## Publication and acceptance

- Source: [PR #50](https://github.com/vibe-coding-milan/am-i-going-broke/pull/50), merged as [ff54a2e](https://github.com/vibe-coding-milan/am-i-going-broke/commit/ff54a2e047802421bc9a0915c5c85f851fedbe7a).
- [GitHub CI passed](https://github.com/vibe-coding-milan/am-i-going-broke/actions/runs/40784039674): 130 JavaScript regression runs, 61 isolated PHP assertions, syntax and tracked-file link checks. Server code is unchanged.
- Configured deployment dry-run identified only app.js, driveSync.js, driveSyncUI.js, index.html and styles.css. Deployment replaced those five files and retained private backups through the existing script. Server-only configuration was preserved.
- HTTPS verification returned 200 and exact byte matches for all five changed files. Homepage, privacy and terms checks also succeeded.
- Existing saved production state remained personal; no existing plan was cleared or replaced. A separate Firefox private window provided a fresh first-use context without Google authorization.
- Private-window production smoke passed: sole Try an example action; fictional identity; scenario and cushion changes; example persistence after reload; disabled example downloads with Drive/import available; direct clean personal setup with the introductory option retained; explicit zero-dollar personal input enables download and removes introductory controls. Personal cushion defaults returned to $1,000/$2,000/$5,000. The private test window was closed afterward.
- Issue [#28](https://github.com/vibe-coding-milan/am-i-going-broke/issues/28) retains ready-to-verify with updated criteria; [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40) and [#25](https://github.com/vibe-coding-milan/am-i-going-broke/issues/25) have release follow-ups. These are not automatically closed by publication.

Owner approval of the preview is recorded above. Physical mobile/browser-version and screen-reader checks remain separate from emulation. Real Drive multi-device acceptance remains open in [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40); no real OAuth authorization or personal-plan transfer is claimed for this release. First-use live/device follow-up belongs to [#28](https://github.com/vibe-coding-milan/am-i-going-broke/issues/28), with broader device testing in [#25](https://github.com/vibe-coding-milan/am-i-going-broke/issues/25).
