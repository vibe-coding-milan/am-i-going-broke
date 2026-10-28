# Automatic Drive sync implementation

## Current milestone

The [sync engine](../driveSync.js), optional [browser interface](../driveSyncUI.js), [PHP service](../server/DriveSyncService.php), and [HTTP endpoint](../api/drive-sync.php) are implemented locally. index.html loads the optional modules, but its endpoint feature flag is empty: ordinary visits introduce no sync controls, sync storage access, or service requests. An explicit drive-sync=preview query on the production origin mounts the new interface without changing the default for other visitors. The private service configuration also defaults to disabled. Production publication is being prepared for an explicit acceptance preview at https://amigoingbroke.me/?drive-sync=preview. See [release status](DRIVE_SYNC_RELEASE.md) for actual deployment evidence; code publication does not establish a working OAuth connection.

Local browser saving and the original manual backup paths remain available. Users who explicitly set up the new service get folder-organized timestamped manual Drive snapshots, even if they later turn automatic sync off. Legacy backups remain discoverable.

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
- The enabled-feature Data menu contains Google Drive sync…, Download a backup, Import a backup…, and Start over…. Original manual Drive actions move into an expandable section inside sync settings, keeping their existing handlers. With the feature off, the original five actions remain with clearer backup labels.
- First-time users get one Connect Google Drive action with visible consent copy; completing authorization finishes explicit setup. Previously authenticated devices get Turn on sync. Older manual-backup users get migration guidance, without automatic imports or automatic opt-in. Established connections use a pause/resume toggle. Reconnection and account changes require a user action.
- Connected account, last successful sync, folder link, recovery-version selection, and explicit conflict choices. Expandable disclosures explain foreground checks and the need to let pending changes finish before switching devices. Both candidates from the last resolved conflict are accessible in Recovery versions on that device.
- Independent per-tab durable outboxes preserve competing candidates. Resume/focus and restored-page checks are throttled with a trailing check for rapid returns, so a foreground refresh is not silently dropped. Changing accounts requires a deliberate decision before the existing device plan can be copied to the new account.
- Reset and restore include an additional cross-device warning when sync is on and preserve a fixed local recovery copy before replacing the plan. Recovery selection is explicit and applies as a new local change.
- On narrow screens, status appears below the header so it cannot squeeze the title or Data/Appearance controls. Desktop status stays beside Data. The disabled feature adds no interface elements.

## Checks performed

- 48 JavaScript sync/browser-safety regressions plus 34 existing scheduling/app regressions in each of two time zones: 116 passing tests. The feature-off checks prohibit network, storage, or DOM side effects from mounting the optional UI. Project syntax and local links pass.
- PHP files linted on the existing PHP 8.2 host. 49 service assertions passed in an isolated temporary directory using simulated Google requests; temporary credential/lock/database files were removed. The JavaScript suite also models phone → work computer → phone → new tablet convergence, and offline phone/work edits preserved through conflict, restart, and deliberate resolution. PHP tests cover encrypted storage, account locks, stale revisions, idempotency, lost initial-create responses, token refresh/revocation failure, bounded recovery, snapshot compatibility, and disconnect retaining Drive data. No real OAuth grant or Drive file was used.
- In-app browser with simulated service data: initial empty-device adoption; cash commit by Enter; delayed single writes; conflict cancellation and explicit Drive adoption; recovery previews; disabled-feature five-action Data menu; and local balance persistence across reload. Missing-file replacement cancellation caused zero writes; explicit replacement completed with exactly one sync write.
- Refined onboarding additionally checked at 1024×768 and 860×700, and the four-action menu checked down to 320px width. System, dark, and light selection and system preference persistence were verified. Simulated authorization completion adopted the existing cloud plan with one read and zero writes; manual snapshot remained available with sync off. Manual-restore cancellation returned to sync settings, while account-change cancellation made no transfers. A phone conflict choice exposed both preserved candidates through recovery with no upload.
- The 320px/200%-root-font fixture with a long account name and expanded manual actions retained a 296px dialog with no horizontal overflow. That stress check also exposed existing mobile section-link and chart-option wrapping issues; labels now wrap and the page remains 320px wide. This fixture does not substitute for physical OS text scaling or browser zoom acceptance.
- Settings checked at 1280×720, 768×1024, 390×844, 320×568, and 568×320. Dialog/button widths remain contained, with scrolling for long content. A discovered mobile header overflow was corrected by moving status below the header. Both themes, long account email addresses, and a 200% root-font stress fixture were inspected. The unavailable-service preview retained local editing with zero sync writes. Screenshots and fixture files are kept in the ignored local preview folder.

## Activation gates

1. Provision the client secret and a random, backed-up 32-byte encryption key privately. Copy the [configuration template](../server/config.example.php) outside the served website; keep the directory 0700 and configuration file 0600. Never overwrite an existing encryption key when credential records exist. No actual secret belongs in Git, browser code, or chat.
2. Register the exact redirect URI `https://amigoingbroke.me/api/drive-sync.php?action=callback` on the existing Web OAuth client. Declare `openid`, email, and `drive.file` access as appropriate in Google Auth Platform and review the updated privacy disclosures. Keep the public audience configuration consistent with the existing verified app.
3. Create a dedicated private state directory outside the website and configure its absolute path. Verify reliable SQLite transactions and filesystem locks on that actual storage; the service is designed for one coordinated host, not independently scaled servers. Verify PHP 8.2+, cURL, sodium, and PDO SQLite in the web runtime as well as CLI. Confirm callback/query log access and retention with the host. The application does not log plans, tokens, or upstream response bodies; normal host logs are separate.
4. Deploy the approved code with the public endpoint flag still empty. With private configuration disabled, status must report unavailable and the existing app must remain functional. Stage the updated privacy policy before inviting anyone to authorize the service.
5. Complete real Google authorization, token refresh, folder creation, manual snapshot/restore, conflict, disconnect, and recovery checks with fictional data and separate accounts in a controlled deployment. Test concurrent service processes, browser tabs, dropped responses, deleted destinations, full browser storage, and account changes. Keep the current plan JSON app-managed; do not edit it directly through other Drive tools.
6. Complete responsive/keyboard/zoom testing of the final build and physical Android/iOS acceptance. Screen-reader announcements and OS text scaling are not certified by emulated viewport checks.
7. The owner has authorized production-URL acceptance testing. Once credentials and callback are configured, enable the private service for that explicit preview; the preview query is preserved through the server-controlled OAuth callback and is never an arbitrary return URL. Only after acceptance, populate the public endpoint feature flag for general availability. Existing users still opt in individually; prior manual Drive authorization must never silently enable sync.

The next setup dependency is the privately configured OAuth client and a real-account acceptance run. The public feature flag remains empty for ordinary visits. The preview URL can expose the interface before configuration, but truthfully reports unavailable and cannot authorize or sync. Publication, deployment, OAuth configuration, and real-account acceptance are separate milestones. Track them in [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40).
