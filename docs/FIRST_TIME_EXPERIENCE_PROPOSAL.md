# First-use experience

Approved through local preview review on October 28, 2026. [Release record](FIRST_USE_RELEASE.md). This document describes the implemented scope; future ideas are separate.

## Entry and ownership

The empty chart offers one action: Try an example. Personal setup uses Cash today and the existing payment controls. Data retains Google Drive, file download/import, and Start over in their existing arrangement. A new device is not assumed to be a new user: Drive remains available to retrieve an existing personal plan before entering any numbers, including from example mode.

Examples have a persistent Fictional example label, a person's name, a short scenario title, one narrative sentence, Next example, and Start my own plan. They remain fictional when edited or reloaded. Download is disabled for examples and empty drafts, with no error message. Import and Drive remain available. Duplicate scenario-loaded notices under Payments are removed; the top banner announces changes politely.

Start my own plan clears fictional financial inputs without a backup/reset warning and focuses Cash today. Try an example remains available until personal financial input exists. A personal plan, file import or Drive retrieval hides introductory controls. A confirmed zero-dollar balance and expenses-only plans are valid. Explicitly clearing the personal plan restores introductory options, using existing personal reset protections and synced-reset semantics.

Plan origin and meaningful personal input are stored explicitly. Legacy unmarked plans are conservatively personal, including zero-dollar plans. Legacy examples retain their fictional marker on import/reload. Example targets never become personal defaults. Existing personal plans cannot enter example mode through the interface or scenario handler. No multi-plan switcher or automatic template adoption is added.

## Eight fictional lives

| Person | Starting view | What exploration reveals | Red / yellow / green |
| --- | --- | --- | --- |
| Riley · Tips vs. rent | 30 days | Rent precedes restaurant wages and tips | $300 / $750 / $1,500 |
| Nia · Cushion era | 6 months | A raise with steady commitments builds cash | $1,500 / $3,000 / $6,000 |
| Jordan · After the layoff | 90 days | Final pay, severance and 26 weekly benefit payments buy time; one year runs short | $2,000 / $5,000 / $10,000 |
| Taylor · Beautifully boring | 90 days | Pay and a roommate's rent share cover recurring bills | $500 / $1,500 / $2,500 |
| Avery · The emergency buffer | 90 days | Staged repairs and four card payments leave a thin cushion; cash recovers over a year | $1,500 / $3,500 / $8,000 |
| Alex · The contract cliff | 60 days | Four contract payments end; delivery work cannot carry the longer horizon | $750 / $1,800 / $3,500 |
| Casey · Class, shifts, repeat | 30 days | Temporary family help ends before a tuition installment | $250 / $600 / $1,200 |
| Morgan · The card-payment creep | 30 days | Scheduled card payments increase; one year runs short | $1,000 / $2,500 / $5,000 |

Dates are anchored to the visit date. All six supported forecast periods remain editable. Next example cycles without immediate repeats, mixing pressure and progress. Existing examples are not replaced on reload, preserving sandbox edits; the next example uses the current catalog.

These model meaningful checking-account deposits and withdrawals, not detailed spending categories or total savings/investment assets. Periodic cash-balance updates account for incidental spending. Routine card purchases appear in scheduled card payments; separate cash commitments include housing, childcare, family rent support, tuition, a handbag, a cabin deposit and a substantial vacation contribution. Upfront repair payments exclude the separately financed portion, which appears only in repayments. Amounts and benefit/payment limits are fictional assumptions, not eligibility rules, computed interest or benchmarks.

## Drive and device switching

Examples never publish. Explicitly opening Drive from an example permits retrieval of a valid personal plan and exits introductory mode. An absent remote plan produces no empty/example upload. Empty personal drafts can retrieve Drive without publishing defaults; confirmed personal zero-dollar input is protected from automatic replacement by a different cloud plan.

Reuse the existing shared-base/revision engine: unchanged local plans adopt remote updates, local edits upload against an expected revision, and genuinely divergent changes preserve both candidates for review. Focus/resume checks remain throttled. No collaborative editor, device lock, field-level merge or routine conflict dialog is added. Switching devices before a save completes or while offline can still require reconciliation; unsent changes cannot be retrieved elsewhere.

## Scope and validation

Preserve the existing dashboard, Data layout, Drive settings, payment editing, appearance controls and humorous header answers. No wizard, new navigation, tour, scenario picker, recurring help panel or analytics is added.

Validation includes 130 JavaScript regression runs, month-boundary/leap-year outcomes, every forecast horizon, distinct ordered targets, personal defaults, origin/backup compatibility, explicit Drive retrieval, stale-write protection and synced resets. Local browser checks covered desktop and narrow-phone layouts, cycle/persistence, horizon changes, direct personal entry, disabled downloads and simulated Drive adoption with zero example uploads.

The owner reviewed and approved the local experience on a MacBook Air M1. Live release smoke checks, physical mobile/screen-reader acceptance and real multi-device Drive results are recorded separately. Track ongoing device/sync acceptance in [#28](https://github.com/vibe-coding-milan/am-i-going-broke/issues/28), [#25](https://github.com/vibe-coding-milan/am-i-going-broke/issues/25) and [#40](https://github.com/vibe-coding-milan/am-i-going-broke/issues/40).
