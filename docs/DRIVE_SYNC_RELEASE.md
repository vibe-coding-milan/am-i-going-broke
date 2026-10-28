# Drive sync production preview — October 28, 2026

## Returning-user refinement

Prepared for publication: read-first connection on ordinary visits, the same four-action Data menu in both modes, focused two-choice comparisons, separate dated manual copies, and legacy-backup migration. Source/CI/deployment evidence will be recorded after release. Automatic sync still requires private OAuth configuration; the ordinary browser connection does not promise background sync.

126 JavaScript runs and 57 isolated PHP assertions passed. Fake Drive fixtures confirmed zero writes during empty-session adoption, explicit local replacement/recovery, older-copy selection, and stale-choice rejection. Dialogs were checked at desktop/tablet/phone/landscape widths and doubled root font size. No conclusion about the owner’s previously saved Drive contents can be drawn from code or fixture tests.

## Initial publication and deployment

Published and deployed on October 28, 2026. [PR #41](https://github.com/vibe-coding-milan/am-i-going-broke/pull/41) merged as [bed88ba](https://github.com/vibe-coding-milan/am-i-going-broke/commit/bed88ba814d19a98431138f15a0ef628989214b9). [PR project checks passed](https://github.com/vibe-coding-milan/am-i-going-broke/actions/runs/40714906599). Owner authorized publication for testing; real OAuth/cross-device acceptance has not passed.

The configured deployment preview and publication succeeded, retaining private backups of replaced files. Live index.html, app.js, styles.css, privacy.html, terms.html and both sync modules match the release byte-for-byte. The homepage and policy pages return HTTP 200. The live status endpoint returns HTTP 200 with {"available":false}; direct HTTP requests for the server class and configuration-template path return 403. No actual configuration/credentials were uploaded.

Live browser smoke checks confirmed four primary Data actions in the explicit preview and five manual/file/reset actions on ordinary visits, with no sync controls introduced on ordinary visits. The preview truthfully displays unavailable; real authorization remains blocked on private OAuth configuration. No real financial plan or Drive file was modified by these smoke checks.

- Preview: https://amigoingbroke.me/?drive-sync=preview
- Ordinary visits: original manual Drive paths, with clearer labels and calm app error dialogs.
- Private sync configuration: not installed when checked. The preview reports unavailable until configured; publishing alone does not connect Google.
- Google callback to register under the Web client's Authorized redirect URIs: `https://amigoingbroke.me/api/drive-sync.php?action=callback`. This is a protocol return address, not a user-facing page or a sign-in test link.
- Follow-up: [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40). Existing dialog, Data menu, and manual Drive issues remain open for owner acceptance.

## Verification

116 JavaScript regression runs passed. PHP files linted on the existing host runtime and 49 service assertions passed using simulated Google requests and isolated temporary storage. No real Google grants or Drive files were used. Cancelled Google-window dialogs were checked at 1280×720, 768×1024, 320×568 and 568×320, without icon/kicker clutter or overflowing text. Earlier sync onboarding, theme, recovery and responsive evidence is in [DRIVE_SYNC.md](DRIVE_SYNC.md).

## Private setup needed

Download the existing Web OAuth client's JSON from Google Auth Platform → Clients, if available. Keep it outside the repository or in the ignored local backup directory; never paste its secret in an issue or chat. If Google requires generating a new secret, the account owner completes that credential step. Configure it only in the private server file described in [DRIVE_SYNC.md](DRIVE_SYNC.md), with a separately protected encryption key and state directory. Register the callback and then test through Connect Google Drive on the preview URL.

Before changing devices, allow pending edits to reach Saved to Drive. Offline changes remain on their originating device until it reconnects. Test concurrent offline edits and recovery using fictional data before broad activation. Physical-device and screen-reader acceptance remain pending.
