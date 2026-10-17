# Am I Going Broke?

A cash-flow forecasting app by Milan Mijatovic. Project future balances, see when money gets tight, and model recurring income, bills, and gaps between contracts.

**[Use the app](https://amigoingbroke.me/)** · [Report a problem](https://github.com/vibe-coding-milan/am-i-going-broke/issues) · [Changelog](./CHANGELOG.md)

## What it does

- Forecast daily balances for up to six months from a starting balance.
- Schedule weekly, monthly, every-two-week, and one-time income and expenses.
- Bound recurring payments with optional start dates, inclusive end dates, or occurrence limits.
- Explore scenarios by excluding individual payments and inspect the chart and ledger.
- Monitor configurable financial cushion targets.
- Save plans in this browser, download and restore JSON backups, and optionally make manual Google Drive backups.

This is a personal planning tool. Its output depends on the dates and amounts you enter; it does not connect to banks, verify transactions, or provide financial, legal, or tax advice.

## Getting started

Open [amigoingbroke.me](https://amigoingbroke.me/), set your current balance, and add your income and expenses using the dates money actually arrives or leaves your account. Review the forecast and adjust your assumptions as circumstances change.

For contract or seasonal work, the final workday and final payday can differ. A contract ending December 18, 2026 might pay for the last time on December 25. Give that payment rule an end date of December 25, then create a separate rule starting January 15, 2027 to represent an unpaid gap.

- Payment bounds are inclusive; the schedule still determines actual payment dates.
- Every-two-week rules follow the **Repeats from** date, even when Starts delays eligibility.
- **After # times** counts scheduled occurrences from Starts, including excluded occurrences. Refreshing the forecast does not restart the count.
- Existing recurring rules without a start date keep their schedule. One-time entries use their exact date.

## Your data and privacy

Plans are saved in browser local storage. Clearing that storage, changing browsers, or moving to another origin can make a plan unavailable. Download a backup before resetting the app or changing devices.

Google Drive is optional and manual, not continuous synchronization. When requested, the app sends the backup directly to Google Drive using the `drive.file` scope. Short-lived access tokens remain in memory, not local storage. The app does not upload financial plans to this GitHub repository or the DreamHost website server.

The app loads Google Fonts. Google authorization and Drive requests occur when using the optional Drive connection. See the [Privacy Policy](https://amigoingbroke.me/privacy.html) and [Terms of Service](https://amigoingbroke.me/terms.html) for details.

**Never post real financial plans, backup files, passwords, or access tokens in GitHub issues.** Use fictional examples in reports and screenshots.

## Run locally

The app uses plain HTML, CSS, and JavaScript. There is no package installation or build step.

```sh
git clone https://github.com/vibe-coding-milan/am-i-going-broke.git
cd am-i-going-broke
```

Open `index.html` in your browser for a quick look. For a consistent local web origin, serve the folder using a static server. For example, if Python 3 is installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open [http://localhost:8000/](http://localhost:8000/). Local browser storage is separate from the production site's storage. Google Drive authorization also requires the local origin to be configured in Google Cloud; it is not required to use the rest of the app.

## Checks

Use Node.js 24 and Bash, then run:

```sh
node scripts/check-project.cjs
```

This checks JavaScript and shell syntax, repository-relative documentation and HTML links, and 11 scheduling regressions in each of two time zones. It does not exercise Google sign-in, actual Drive uploads, or all browser interactions. Manually check the affected UI at desktop and phone widths when changing it.

[Project checks](https://github.com/vibe-coding-milan/am-i-going-broke/actions/workflows/checks.yml) run on pushes, pull requests, and manual requests. They do not deploy or use the DreamHost secret.

## Project structure

| Path | Purpose |
| --- | --- |
| [index.html](./index.html), [styles.css](./styles.css), [app.js](./app.js) | Main application UI, styling, storage, scheduling, and backup integration |
| [projectionHealth.js](./projectionHealth.js) | Projection health calculations |
| [components/](./components/), [content/](./content/), [styles/](./styles/) | Projection answer presentation, copy, and styling |
| [assets/](./assets/) | Brand and consent-screen assets |
| [privacy.html](./privacy.html), [terms.html](./terms.html) | Hosted policies |
| [tests/](./tests/), [scripts/](./scripts/) | Scheduling regressions, project checks, and deployment tools |
| [.github/](./.github/) | Checks, manual deployment, dependency updates, and issue templates |

## Publishing and DreamHost deployment

The production address is **https://amigoingbroke.me/**. Saving locally, committing, and publishing to GitHub are distinct steps. The current Codex workflow publishes through the connected GitHub account; direct terminal `git push` requires a separately configured GitHub login.

1. Make changes, run the checks, and update the changelog for meaningful changes.
2. Commit and publish the intended files to GitHub's `main` branch. Confirm the automatic checks pass.
3. Open [Deploy to DreamHost](https://github.com/vibe-coding-milan/am-i-going-broke/actions/workflows/deploy-dreamhost.yml) and click **Run workflow**, using branch **main**.
4. Select **preview** to test authentication and list proposed uploads without modifying the site.
5. Review the preview, then run the workflow with **deploy** to publish.

Deployments run the same project checks first. They use the `DREAMHOST_SSH_KEY` repository secret to connect to `iad1-shared-b8-06.dreamhost.com` as `mmijatov` and publish to `/home/mmijatov/amigoingbroke.me`. The public server key is pinned in [scripts/dreamhost_known_hosts](./scripts/dreamhost_known_hosts). Private keys stay outside the repository.

Only tracked public app files are uploaded. Documentation, tests, workflows, and Git history are excluded. Server-only files such as `.htaccess` are preserved. These are in-place uploads, not an atomic release switch; deployment is serialized to prevent overlapping uploads.

Replaced files are backed up outside the public website under `/home/mmijatov/.amigoingbroke-deploy-backups/<run-id>-<attempt>/`. These are backups of replaced files, not complete website snapshots. Deleted repository files are not automatically deleted from DreamHost. To roll back, revert the unwanted GitHub change and deploy again; newly introduced unwanted files need a separate cleanup.

After deploying, check the workflow result and the live app. Deployment checks HTTP responses for the homepage and both policy pages. A successful upload is not a substitute for checking changed browser behavior.

Keep backups of user plans separately. Website deployments do not back up browser storage or users' Google Drive files. See [maintenance notes](./docs/MAINTENANCE.md) for deployment credentials and history recovery.

## Optional Google Drive configuration

Production is configured with a public Google OAuth web client ID in `index.html`. To run your own authorized configuration, enable the Google Drive API in the corresponding Google Cloud project and register the correct JavaScript origin. Production uses `https://amigoingbroke.me`.

```html
<meta name="google-drive-client-id" content="YOUR_PUBLIC_OAUTH_CLIENT_ID" />
```

A client ID is public frontend configuration. Never put a Google client secret in this app. If connection succeeds but backup fails, check that the Drive API is enabled in the project owning the client ID.

## Ownership and project status

Copyright © 2026 Milan Mijatovic. All rights reserved. This is a proprietary, solo-maintained project whose source is public for inspection. It is not offered under an open-source license. See [LICENSE.md](./LICENSE.md) for the rights notice, GitHub platform exceptions, and third-party materials.

Unsolicited code contributions are not currently accepted. Bug reports and suggestions are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md). Report security concerns privately as described in [SECURITY.md](./SECURITY.md).

The focused scheduling work is recorded in [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md). Future ideas are not promises or a release schedule.
