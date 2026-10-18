# Issues and owner acceptance

Implementation, deployment, and owner acceptance are separate milestones. Use the issue itself as the record; no separate tracking system is needed.

## Start testing

- [Ready to verify](https://github.com/vibe-coding-milan/am-i-going-broke/issues?q=is%3Aissue%20is%3Aopen%20label%3Aready-to-verify)
- [Needs investigation](https://github.com/vibe-coding-milan/am-i-going-broke/issues?q=is%3Aissue%20is%3Aopen%20label%3Aneeds-investigation)
- [Active implementation](https://github.com/vibe-coding-milan/am-i-going-broke/issues?q=is%3Aissue%20is%3Aopen%20label%3Ain-progress)
- [Shared device testing hub: #25](https://github.com/vibe-coding-milan/am-i-going-broke/issues/25)

Use fictional data and a separate profile/test plan when checking destructive actions or backup restoration.

## Labels

Choose one primary work category:

| Label | Meaning |
| --- | --- |
| bug | Unexpected or incorrect behavior to investigate or correct. It does not establish a root cause. |
| enhancement | Improve an existing capability, usability, or quality of life. |
| feature | Introduce a new capability; define success criteria first. |
| documentation | Improve instructions or project documentation. |
| testing | Device, accessibility, compatibility, or regression validation work. |

Use at most one workflow label on an open issue:

| Workflow label | Meaning |
| --- | --- |
| No workflow label | Reported, untriaged, or backlog proposal; no implementation commitment. |
| needs-investigation | Gather evidence, clarify scope, or investigate a failed acceptance check. |
| in-progress | A scoped solution is actively being implemented. |
| ready-to-verify | Implemented, live, technically checked, and supplied with a short owner/tester checklist. |

Priority is separate: use priority:high or priority:low only when explicitly decided. Normal priority needs no label. Preserve the priority while changing workflow stages.

Retain duplicate for linking duplicate reports. Retain dependencies and github_actions for dependency-maintenance pull requests; they are not acceptance stages.

Archived unused labels: good first issue and help wanted do not fit the solo-maintainer contribution policy; invalid, question, and wontfix were vague or duplicated clearer investigation/closure explanations. Archiving keeps them recoverable. No historical dependency labels were removed.

## From report to acceptance

1. **Report:** Record the problem, expected outcome, and observable success criteria. For bugs, include reproduction steps. For usability improvements, describe what someone should understand or accomplish without coaching. For features, describe the new task and important edge cases.
2. **Implement:** Apply in-progress only while actively working. Record the chosen scope and preserve previous reports.
3. **Deploy and hand off:** Record the release/commit and live URL, technical checks, known limits, and a short checkbox list with specific steps and expected results. Replace the workflow label with ready-to-verify. Keep the issue open. A merge, passing tests, or deployment is not owner acceptance.
4. **Verify:** The maintainer or a named tester checks the live behavior. Mark only observed checks complete and record the result below. Not tested is distinct from Pass. If the result is reported in chat, it may be recorded on GitHub on the reporter's behalf; do not invent testing or approval.
5. **Accept:** Once all relevant checks pass and the maintainer/tester accepts the result, remove ready-to-verify and close as Completed. A separate verified label is unnecessary.
6. **Failed check:** Keep the issue open, record expected versus observed behavior and device/release, remove ready-to-verify, and apply needs-investigation. Once actively fixing it, switch to in-progress; after a new deployed and checked fix, return to ready-to-verify. Reopen the original issue if a supposedly accepted fix still fails; use a linked new issue for a materially different problem.

Do not use automatic issue-closing references for work awaiting acceptance. Close duplicate or declined proposals with a linked explanation and the appropriate closure reason; that does not mean they were implemented or verified.

## Acceptance record

A short comment is sufficient:

```text
Result: Pass / Fail / Not tested
Tester:
Date:
Device, OS, and browser version:
Release/commit:
Checks completed and observations:
```

Keep the short verification checklist near the top of the issue. Technical/deployment checkboxes may be completed by the implementer with evidence; owner/tester checkboxes remain unchecked until actually tested. Screenshots can support the result but do not replace observed behavior or prove accessibility conformance.

The October 18 release has seven ready-to-verify issues (#28–#33 and #35). Download compatibility (#34) remains under investigation: hardening is deployed, but the original file was eventually found and no blocker, network, or battery cause has been established. Existing release notes and source context remain in those issues.
