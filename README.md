# amigoingbroke.me

Live app: [amigoingbroke.me](https://amigoingbroke.me/).

A lightweight V1 web app for projecting cash balance from:

- a starting cash balance
- recurring weekly or monthly rules
- one-time money in and money out
- optional overrides for variable items

## Why this matches the spreadsheet workflow

The attached spreadsheet's `Milan Cash Flow` sheet is already using a strong mental model:

- `Day`
- `Expense`
- `Money in`
- `Money out`
- `Balance`

The app also treats your `Current Cash Management Balance` as the starting point
for the whole run, just like the first row in the spreadsheet.

This prototype keeps that same core idea, but makes the daily projection generated instead of manually rebuilt each month.

## Current V1 behavior

- Generate a forward cash projection up to six months.
- Support recurring monthly items such as rent, mortgage, or cards due on a day of the month.
- Support recurring weekly items such as paychecks.
- End recurring items after a set number of times or on a specific date.
- Mark rules as fixed or variable.
- Color-code balances based on configurable thresholds.
- Save everything in browser local storage.
- Download and restore local data as JSON.
- Optionally save and restore a manual backup in Google Drive.
- Reset saved browser data safely.
- Use versioned local storage with migration from older app keys.

## Project structure

- [index.html](./index.html)
- [privacy.html](./privacy.html)
- [terms.html](./terms.html)
- [styles.css](./styles.css)
- [app.js](./app.js)

## How to use it

Use the live app at [amigoingbroke.me](https://amigoingbroke.me/).

For local development, clone this repository and open [index.html](./index.html) in a browser.

Suggested first setup:

1. Set your current cash balance.
2. Add your recurring money in and money out items.
3. Review the projection chart, analysis, table, and running balances.

## Contract and seasonal payments

Recurring income and expenses support an optional **Starts** date and an inclusive
**Ends → On date** limit. Enter the dates money reaches or leaves your account,
rather than the dates you perform the work. The weekly, monthly, or every-two-week
schedule determines which payments occur within those bounds.

For example, a contract ending December 18, 2026 could make its final Friday
payment on December 25. Set that rule's last payment date to December 25. Add a
separate rule for the next contract, starting January 15, 2027, to leave January 1
and January 8 without paychecks from either contract.

- Existing rules without a start date continue from the forecast start.
- Every-two-week payments follow the **Repeats from** date; Starts can delay eligibility without changing that cadence.
- **After # times** counts scheduled occurrences from Starts, including excluded occurrences. Refreshing the forecast does not restart that count.
- One-time entries continue to use their exact date.
- Start/end dates are included in downloaded and optional Drive backups.

The focused implementation scope is tracked in [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md),
and completed changes and verification are recorded in [CHANGELOG.md](./CHANGELOG.md).

Run scheduling regression checks with:

```sh
TZ=America/New_York node --test tests/scheduling.test.cjs
TZ=Pacific/Auckland node --test tests/scheduling.test.cjs
```

## Hosting

The production URL is [https://amigoingbroke.me/](https://amigoingbroke.me/).

This app can be hosted as a simple static site. Publish these files and supporting directories, preserving their relative paths:

- [index.html](./index.html)
- [privacy.html](./privacy.html)
- [terms.html](./terms.html)
- [styles.css](./styles.css)
- [app.js](./app.js)
- [projectionHealth.js](./projectionHealth.js)
- [assets/](./assets/)
- [components/](./components/)
- [content/](./content/)
- [styles/](./styles/)

Public pages: [Privacy Policy](https://amigoingbroke.me/privacy.html) and
[Terms of Service](https://amigoingbroke.me/terms.html).

User data is stored in the browser, so updating the HTML, CSS, or JS on the server should not erase existing local data. For extra safety, users can export a JSON backup before major updates.

## Optional Google Drive backup

Google Drive is an optional manual backup destination. It does not replace browser storage or
provide realtime sync. The app uploads the existing JSON export payload directly to the user's
Drive using the narrow `drive.file` scope.

After connecting, the app remembers the Drive connection in this browser. Google access tokens
remain short-lived and are not stored in local storage; the app requests a fresh token when a
later backup or restore needs one.

To enable it, create a Google OAuth 2.0 Web client, add `https://amigoingbroke.me` as an authorized
JavaScript origin, enable the Google Drive API in the same Google Cloud project, and set the public client ID in
`index.html`:

```html
<meta name="google-drive-client-id" content="YOUR_PUBLIC_OAUTH_CLIENT_ID" />
```

OAuth client IDs are public frontend configuration. Do not add a Google client secret to this app.

If Google account connection succeeds but saving a backup fails, confirm that **Google Drive API**
appears under **APIs & Services → Enabled APIs & services** for the project that owns the OAuth
client ID.

## Recommended next steps

### V1.1

- Add support for twice-monthly schedules.
- Add a separate recurring rule library and monthly scenario layer.
- Add export/import to JSON so the setup can move across devices.

### V1.2

- Add Google Sheets import/export.
- Add "needs attention" warnings when balance crosses thresholds.
- Add notes and categories on entries.
- Add multiple account views.

### V2

- Add authentication and cloud sync.
- Add mobile-first entry flows for fast updates.
- Add calendar integration and reminders for variable items that need review.

## Best input to provide next

To make the next iteration useful quickly, the most helpful input is:

1. Your real recurring rule list.
2. Which schedule types you need beyond weekly and monthly day-of-month.
3. Which items are fixed vs variable.
4. Whether you want Google Sheets to remain the source of truth or become optional.
5. Whether you want a local-only app first or a hosted web app.
