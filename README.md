# Am I Going Broke?

A cash-flow forecasting app by Milan Mijatovic. See how upcoming income and expenses may affect your balance, explore different scenarios, and plan for gaps between paychecks or contracts.

**[Use the app](https://amigoingbroke.me/)** · [Report a problem](https://github.com/vibe-coding-milan/am-i-going-broke/issues) · [Changelog](./CHANGELOG.md)

## What it does

- Projects future balances from your starting cash balance.
- Supports recurring and one-time income and expenses.
- Lets you set payment start dates, end dates, and occurrence limits.
- Shows your forecast in a chart and detailed ledger.
- Helps you explore scenarios by excluding individual payments.
- Highlights configurable financial cushion targets.
- Offers eight editable fictional examples with different cash-flow stories and cushion targets.
- Supports downloadable personal-plan backups and optional automatic Google Drive sync.

## Getting started

Open [amigoingbroke.me](https://amigoingbroke.me/) and choose Try an example to explore fictional plans, or enter Cash today and add your own payments. Use the forecast period to explore how the outlook changes over time. Examples remain fictional when edited and cannot be downloaded or synced. Start my own plan clears the example and focuses Cash today.

Forecast meaningful movements in your primary cash account: paychecks, rent, card payments, transfers and major one-time expenses. Use the dates money actually reaches or leaves the account. Routine card purchases belong in the expected card payment rather than being counted again individually. Periodically update Cash today to your actual balance.

For seasonal or contract work, create separate income rules for each paid period to represent unpaid gaps. Payment start and end dates are inclusive; the recurring schedule determines the actual payment dates within those bounds.

## Your data

Plans save in your browser. Personal plans can be downloaded or imported through Data; empty drafts and fictional examples cannot be downloaded. A confirmed zero-dollar balance is valid personal data. Clearing browser storage can remove a local plan, so keep a backup or use optional Drive sync.

Connect through Data → Google Drive to retrieve an existing plan on a new device or enable automatic sync. Wait for pending changes to finish before switching devices. On return, an enabled connection checks Drive for updates; conflicting edits are preserved for review. Examples can retrieve an existing Drive plan but never upload fictional data.

Drive sync uses the app’s server-backed connection to Google. See the privacy policy for server processing and storage details. Financial plans are never published to this GitHub repository.

See the [Privacy Policy](https://amigoingbroke.me/privacy.html) and [Terms of Service](https://amigoingbroke.me/terms.html) for details.

## Limitations

This is a personal planning tool. Forecasts depend on the amounts and dates you enter. The app does not connect to banks or verify transactions, and it does not provide financial, legal, or tax advice.

## Feedback

Bug reports and suggestions are welcome through [GitHub Issues](https://github.com/vibe-coding-milan/am-i-going-broke/issues). Use fictional examples and remove personal information from screenshots. Never post real financial plans, backup files, passwords, or access tokens.

This is a solo-maintained project; unsolicited code contributions are not currently accepted. See [feedback guidelines](./CONTRIBUTING.md). Report security concerns privately using [SECURITY.md](./SECURITY.md).

## About this repository

The app uses HTML, CSS, and JavaScript. Source is available for inspection, with automated checks covering source syntax, documentation links, and scheduling regressions. Changes to this repository do not automatically publish a new website version.

## Ownership

Copyright © 2026 Milan Mijatovic. All rights reserved. This project is not offered under an open-source license. See [LICENSE.md](./LICENSE.md) for the rights notice, GitHub platform exceptions, and third-party terms.
