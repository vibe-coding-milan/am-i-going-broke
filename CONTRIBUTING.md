# Feedback and contributions

Am I Going Broke? is created and maintained by Milan Mijatovic. Unsolicited source-code contributions and pull requests are not currently accepted. Bug reports and feature suggestions are welcome. Automated maintenance pull requests from Dependabot are reviewed by the maintainer.

## Report a problem

Search [existing issues](https://github.com/vibe-coding-milan/am-i-going-broke/issues) first. Include the steps to reproduce the issue, expected behavior, actual behavior, browser, device, and whether the issue occurs on the live site or a local copy.

Use fictional amounts, dates, and account names. Do not upload real financial data, JSON backups, credentials, Google tokens, or private keys. Remove personal information from screenshots. Report suspected security issues privately using [SECURITY.md](./SECURITY.md).

## Suggest an improvement

Describe the problem and the outcome you want. Suggestions are welcome but do not create a commitment to implement them or a delivery date.

## Maintainer workflow

Use the [issue and acceptance workflow](docs/ISSUE_WORKFLOW.md) to distinguish implementation from owner acceptance. Keep deployed product changes open with `ready-to-verify` until the maintainer or tester confirms the live result. Do not automatically close these issues when merging or deploying. Record acceptance before closing as Completed.

Read the [README](./README.md) for local setup. Run `node scripts/check-project.cjs` before publishing. For browser changes, also check the affected flow on desktop and phone widths, persistence after reload, and backup compatibility when relevant. Use synthetic data.

Update [CHANGELOG.md](./CHANGELOG.md) for meaningful changes, distinguishing published source from deployed website changes. Publish through the connected GitHub account or an authenticated Git client. Checks run automatically; production deployment remains a separate manual action.

Public visibility and these feedback guidelines do not grant reuse rights. See [LICENSE.md](./LICENSE.md).
