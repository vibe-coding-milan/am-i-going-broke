# First-use experience release — October 28, 2026

Status: release preparation; production verification pending.

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

Source revision, CI, deployment and live smoke evidence will be recorded here after completion. Server code is unchanged; PHP validation runs in GitHub CI because PHP is unavailable in the local environment.

Owner approval of the preview is recorded above. Physical mobile/browser-version and screen-reader checks remain separate from emulation. Real Drive multi-device acceptance remains open in [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40); no real OAuth authorization or personal-plan transfer is claimed for this release. First-use live/device follow-up belongs to [#28](https://github.com/vibe-coding-milan/am-i-going-broke/issues/28), with broader device testing in [#25](https://github.com/vibe-coding-milan/am-i-going-broke/issues/25).
