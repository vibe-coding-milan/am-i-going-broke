# Maintenance overview

## Checks and publication

Source publication and website deployment are separate. Pushes and pull requests run automated checks without production credentials. Production publication is started manually and defaults to a preview.

The maintainer can run `node scripts/check-project.cjs` to check syntax, local documentation and HTML link targets, and scheduling regressions in two time zones. Browser interactions and actual Google Drive authorization and transfers need separate manual verification when affected by a change.

Workflows use specified operating-system and Node.js versions, with actions pinned to commit SHAs. Dependabot proposes updates for maintainer review; updates are not automatically merged.

## Operational information

Account identifiers, server addresses, personal filesystem locations, credential locations, and backup inventories do not belong in public-facing project documentation. Detailed operational notes are maintained privately by the owner.

Keep deployment credentials outside version control. If a credential is compromised, revoke or rotate it at its issuing service; deleting a file alone does not remove historical copies. Investigate unexpected server host-key changes rather than bypassing verification.

## Recovery

Deployment retains copies of replaced website files and preserves server-only files. This is not a complete site snapshot or a backup of users' financial plans. Obsolete files require a separate review before removal. Backup retention should be reviewed periodically.

For a code rollback, restore the intended source version, run the checks, and publish it manually. Confirm the live site afterward. Record source publication and actual deployment separately in the changelog.

The original development history has a verified private recovery copy. Its location and recovery details are documented privately. That copy is a point-in-time snapshot, not continuous backup.

## Product backlog

Completed changes are recorded in the [changelog](../CHANGELOG.md). Dashboard redesign, richer scenarios, compact mobile editing, and additional integrations remain ideas, not scheduled commitments. The [cleanup inventory](./CLEANUP.md) records retired project files.
