# Drive sync production preview — October 28, 2026

## Publication and deployment

Prepared for publication; final commit, PR, CI and live verification will be recorded after completion. Owner authorized publication for testing, not a claim that real OAuth/cross-device acceptance has passed.

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
