# Automatic Drive sync implementation

## Current milestone

There is now one Google Drive connection: the [server-backed sync interface](../driveSyncUI.js) and [sync engine](../driveSync.js). The browser-only connection, manual Drive transfer controls, and last-backup indicator have been retired. Data retains file download/import and Start over. Connecting explicitly enables automatic sync, discovers or creates Am I Going Broke?, and reconciles the current plan; an empty device adopts an existing plan, while genuinely different populated plans require a choice.

This simplification is live. The owner created an additional Google OAuth secret, stored it in the ignored private credential file, and reported registering the callback. The new credential has been installed in a disabled private server configuration with a separately backed-up encryption key. Real Google authorization and renewal with the new secret have passed; exact folder/current-file names and readability were verified without exposing financial contents. Cross-device and physical-device acceptance remain separate. When the service is unavailable, the unified interface reports that truthfully rather than presenting a backup connection as sync. Earlier releases and their acceptance evidence are retained in [release history](DRIVE_SYNC_RELEASE.md).

Existing hosting was checked read-only: PHP 8.2 with cURL, PDO SQLite, and sodium is available. No server configuration, Google permission, or production file was changed by that runtime check. A subsequent configuration-presence check found no private OAuth configuration installed.

## Implemented behavior

- A meaningful plan edit resets a five-second inactivity timer. Continuous completed edits have a thirty-second maximum wait. Cosmetic state and generated export timestamps do not reset the timer or create writes.
- Sample scenarios and incomplete or invalid plans stay local. Validation preserves the cash balance's original as-of date.
- One request runs at a time. An edit made during an upload remains pending until that exact newer version is acknowledged.
- Pending contents and the last shared version are persisted through an injected durable store. No downloaded files are generated. One bounded recovery slot retains both candidates when a conflict is resolved.
- Both the durable queue and every remote response are bound to a Google account ID. A remembered opt-in cannot upload until the server session is explicitly established for the same account.
- An empty new device adopts the existing remote plan. Two different existing plans require an initial choice. Later concurrent changes preserve both versions for resolution.
- A missing remote plan pauses sync instead of silently recreating deleted data. Malformed or wrong-account responses are never applied.
- Temporary errors back off; new edits cannot defeat the backoff. Authorization errors pause until reconnection. A lost acknowledgement is reconciled through a fresh read before retrying a write.
- Turning sync off cancels queued work and preserves local data. A request already accepted by the server may complete; it cannot be recalled by toggling off.

## Engine integration contract

Create a controller with accountId, storage, transport, and optional clock/status/application callbacks. The account ID must come from an authenticated server session, not a text field or remembered email address.

storage.load(accountId) and storage.save(accountId, record) must provide durable, account-bound storage. load may return null for a new device. A failed save must throw: the engine pauses rather than promise durable recovery. The app's current browser storage remains the source of immediate device recovery; this queue is additional sync metadata and pending content, not a downloaded backup.

transport.read returns:

```json
{
  "accountId": "verified-google-subject-id",
  "revision": "opaque-version-or-null",
  "savedAt": "server-time-or-null",
  "plan": null
}
```

When a plan exists, plan contains the financial fields returned by planData and revision must be a nonempty opaque version. An absent plan uses null for both plan and revision.

transport.write accepts accountId, expectedRevision, operationId, and plan, and returns the same shape with the exact acknowledged plan. It MUST atomically reject an outdated expectedRevision and deduplicate operationId. A read followed by an unconditional Drive PATCH does not satisfy this contract: two devices could overwrite each other between those calls. This guarantee must be implemented and tested in the server service before integration.

Transport errors use these codes: auth (reconnect), account (wrong account), missing (deleted/inaccessible destination), remote (invalid data), and conflict (stale version). Other errors retry with increasing delay. On a stale-write rejection, the engine reads again and preserves both candidates for resolution.

Lifecycle:

1. Persist the ordinary browser plan immediately using the current application save path.
2. Pass the completed plan to setPlan. Preserve local invalid drafts, but never upload them. UI-only changes cause no sync work.
3. Call authorize only after a successful same-account server-session check. Enabling requires the user's explicit opt-in; manual Drive authorization does not imply opt-in.
4. Call setOnline on connectivity changes. Call check on app resume/focus with throttling in the browser adapter; do not poll continuously.
5. Present snapshot status through a stable accessible indicator. Show conflicts as deliberate choices, not automatic last-writer-wins decisions.
6. Call destroy when the controller is replaced or its account is switched. Do not reuse an account's pending queue for another account.

Status values are internal state, not finished UI copy. The browser adapter must coordinate tabs and preserve each tab's unsynced candidate. Never update a stale tab's remembered base revision merely because another tab announced a save. Server version checks remain mandatory even if a browser lock is used.

## Implemented browser/service integration

- Redirect authorization-code flow with PKCE and a single-use, expiring session state. Google account identity comes from Google's userinfo endpoint using the server-exchanged access token; a verified email is required. The client secret and refresh tokens never reach browser JavaScript.
- Encrypted SQLite credential records and account-specific filesystem locks outside the served website. Secure HTTP-only SameSite session cookies, CSRF-protected mutations, exact-origin checks, rate limits, payload/response bounds, strict TLS, and generic public errors.
- Atomic version checks among all writers routed through this service. Initial creates use reserved Google file IDs; duplicate retries and lost initial-create responses do not generate multiple working files. Direct external editing of the working JSON file during an upload is outside that serialization guarantee and is not a supported editing surface.
- App-owned folder discovery by IDs/properties, one Current plan.json, and manual snapshots in Backups. A deleted or inaccessible folder/file pauses sync; it is not silently recreated. Check Drive again retries a restored destination; creating a replacement requires explicit confirmation and never deletes existing files. Recovery reads expose up to three previous synced versions. Manual backup history is not automatically pruned.
- The enabled-feature Data menu contains Google Drive sync…, Download a backup, Import a backup…, and Start over…. Original manual Drive actions move into an expandable section inside sync settings, keeping their existing handlers. Without the automatic feature, the read-first browser connection supplies the same four primary actions.
- First-time users get one Connect Google Drive action with visible consent copy; completing authorization finishes explicit setup. Previously authenticated devices get Turn on sync. Older manual-backup users get migration guidance, without automatic imports or automatic opt-in. Established connections use a pause/resume toggle. Reconnection and account changes require a user action.
- Connected account, last successful sync, folder link, recovery-version selection, and explicit conflict choices. Expandable disclosures explain foreground checks and the need to let pending changes finish before switching devices. Both candidates from the last resolved conflict are accessible in Recovery versions on that device.
- Independent per-tab durable outboxes preserve competing candidates. Resume/focus and restored-page checks are throttled with a trailing check for rapid returns, so a foreground refresh is not silently dropped. Changing accounts requires a deliberate decision before the existing device plan can be copied to the new account.
- Reset and restore include an additional cross-device warning when sync is on and preserve a fixed local recovery copy before replacing the plan. Recovery selection is explicit and applies as a new local change.
- On narrow screens, status appears below the header so it cannot squeeze the title or Data/Appearance controls. Desktop status stays beside Data. The disabled feature adds no interface elements.

## Checks performed

- 48 JavaScript sync/browser-safety regressions plus 30 retained scheduling/app regressions in each of two time zones: 108 passing tests. Retired browser-only transfer tests were removed with that implementation. The feature-off checks prohibit network, storage, or DOM side effects from mounting the optional UI. Project syntax and local links pass.
- PHP files linted on the existing PHP 8.2 host. 61 service assertions passed in an isolated temporary directory using simulated Google requests; temporary credential/lock/database files were removed. The JavaScript suite also models phone → work computer → phone → new tablet convergence, and offline phone/work edits preserved through conflict, restart, and deliberate resolution. PHP tests cover encrypted storage, account locks, stale revisions, idempotency, lost initial-create responses, token refresh/revocation failure, bounded recovery, snapshot compatibility, and disconnect retaining Drive data. No real OAuth grant or Drive file was used.
- In-app browser with simulated service data: initial empty-device adoption; cash commit by Enter; delayed single writes; conflict cancellation and explicit Drive adoption; recovery previews; disabled-feature five-action Data menu; and local balance persistence across reload. Missing-file replacement cancellation caused zero writes; explicit replacement completed with exactly one sync write.
- Refined onboarding additionally checked at 1024×768 and 860×700, and the four-action menu checked down to 320px width. System, dark, and light selection and system preference persistence were verified. Simulated authorization completion adopted the existing cloud plan with one read and zero writes; manual snapshot remained available with sync off. Manual-restore cancellation returned to sync settings, while account-change cancellation made no transfers. A phone conflict choice exposed both preserved candidates through recovery with no upload.
- The 320px/200%-root-font fixture with a long account name and expanded manual actions retained a 296px dialog with no horizontal overflow. That stress check also exposed existing mobile section-link and chart-option wrapping issues; labels now wrap and the page remains 320px wide. This fixture does not substitute for physical OS text scaling or browser zoom acceptance.
- Settings checked at 1280×720, 768×1024, 390×844, 320×568, and 568×320. Dialog/button widths remain contained, with scrolling for long content. A discovered mobile header overflow was corrected by moving status below the header. Both themes, long account email addresses, and a 200% root-font stress fixture were inspected. The unavailable-service preview retained local editing with zero sync writes. Screenshots and fixture files are kept in the ignored local preview folder.

## Activation and acceptance

1. Provision the Web client secret and a random backed-up 32-byte encryption key in a 0600 private configuration outside the served website, with a 0700 private state directory. Never overwrite an encryption key when account records exist. No credential belongs in Git or chat. This provisioning is complete; configuration was enabled after checked deployment.
2. Register exactly `https://amigoingbroke.me/api/drive-sync.php?action=callback` on the existing Web OAuth client. The owner saved this and the real Google authorization flow passed; opening the callback directly is not a sign-in test.
3. Deploy the unified interface and matching PHP service. Check the web runtime, HTTPS/secure-cookie behavior, protected server paths, and status response. Enable private configuration only after the published code matches the checked release.
4. Have the owner choose Connect on the live URL and approve Google authorization. Verify server-side identity exchange and token refresh with the new secret, without exposing tokens, identity details or plans in logs. Then the owner can retire the old secret in Google Cloud.
5. Complete same-account new-device adoption, folder creation, delayed updates, concurrency/conflict, pause, reconnect, recovery, and disconnect acceptance. Keep Current plan.json app-managed and all service writers on the same coordinated host.
6. Record physical Android/iOS, browser zoom/OS scaling, keyboard and screen-reader acceptance separately from emulated viewport checks. Publication alone is not acceptance. Track unresolved results in [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40).

## Returning-user connection and minimal dialogs

- Connecting makes only reads. A fresh empty session adopts a nonempty saved plan, with zero Drive writes. A latest empty copy does not erase a populated device; older saved copies remain selectable under More options.
- Prefer an existing current sync file over manual snapshots. Discover app-owned files afresh through the currently authorized account, rather than trusting a cached file ID. Ask Google to select the account for a new browser authorization.
- Differing plans get two summaries, the Drive save date, and two choices. There is no second confirmation; selecting Drive rechecks the file and current device plan, preserves the local plan, then applies. A concurrent change refreshes the comparison instead. Keeping this device performs no Drive write.
- The retired browser-only connection clearly said automatic sync was off. Backup/recovery, saved-copy selection, reconnect/check and disconnect controls are collapsed under More options. A successful empty-session pickup needs only Done. Local recovery remains accessible without a Google connection.
- Manual saves block empty, sample and unfinished plans. Matching content creates no duplicate. Other deliberate saves create a new timestamped file after showing the existing plan date, with no PATCH of existing files. Filename and export timestamp share the same instant.
- Automatic setup discovers an older manual backup when no current sync file exists. It uses a versioned read-only baseline. A first later edit creates a separate current file and retains the manual backup; a concurrent manual-file change rejects a stale write. An empty new device can therefore pick up its prior manual plan without erasing it.
- Browser fixtures verified adoption, explicit loading/recovery, empty-latest/older-copy selection, cancellation, and a concurrent remote change with zero Drive writes. Comparison dialogs fit 1280×720, 1024×768, 768×1024, 390×844, 320×568 and 568×320. A 320px/200%-root-font test with More options expanded retained a 296px dialog and 320px page. Light/dark/system checks passed. These are simulated Google responses and emulated widths, not real-account or physical-device certification.

Private provisioning and live activation are separate from owner/device acceptance; consult the release log for actual results.

## Unified connection release

The normal Data menu now mounts the server-backed sync interface directly. There is no browser-only OAuth token path, manual Drive save/import UI, or last-backup status. Download a backup and Import a backup remain local-file actions. Completing Connect enables sync; pause/resume is then controlled by one toggle. Ordinary settings show the account, Automatic sync toggle and Am I Going Broke? folder, with Disconnect and Done in the footer. Routine status/time and mechanics are omitted; problems and recovery appear only when relevant. The Data icon carries the compact sync indication.

Connect materializes an existing legacy cloud plan as a separate Current plan.json inside the app folder. It never replaces the old backup and does not pick between different device/cloud plans. Account-lock version checks handle concurrent migration and repeated connection makes no extra writes. The old public manual-backup API routes are retired; legacy reads stay available internally for migration.

Mock browser checks: callback completion enabled sync and adopted the remote plan with zero device-plan uploads; committing a balance then waiting five seconds produced exactly one automatic write. No manual snapshots were created. Settings fit 1280×720, 768×1024, 390×844, 320×568, and 568×320 without horizontal overflow. Local recovery remains available when the service or Google session is unavailable. Real-account authorization and refresh passed as recorded in the release log; remaining multi-device acceptance is tracked separately.
