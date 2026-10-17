# Maintenance and recovery

## Publishing, checks, and deployment

Source publication and website deployment are separate. Pushes and pull requests run project checks without production credentials. The DreamHost workflow is manual and defaults to preview. See the [README deployment instructions](../README.md#publishing-and-dreamhost-deployment).

Workflows use Ubuntu 24.04, Node.js 24, and actions pinned to commit SHAs. Dependabot proposes weekly GitHub Actions updates; these are not automatically merged. Review release notes and wait for checks before accepting an update.

## Deployment credentials

`DREAMHOST_SSH_KEY` is stored as an encrypted GitHub Actions repository secret. The private key is outside this repository on the maintainer's Mac at `~/.ssh/amigoingbroke_dreamhost_deploy`. Its public half is authorized on DreamHost. Never add either private key contents or financial backup data to Git.

The key authenticates as the DreamHost shell user `mmijatov`; its access is not restricted to the website upload directory. Treat it as access to that user's files. If the key is compromised or access is no longer needed, remove the corresponding public key from that user's `~/.ssh/authorized_keys`, replace the GitHub secret as appropriate, and test a preview. Do not remove unrelated authorized keys.

A host-key mismatch must be investigated before changing `scripts/dreamhost_known_hosts`. Do not bypass strict host checking. DreamHost currently negotiates an SSH connection without post-quantum key exchange; enabling newer algorithms is a hosting-provider matter.

## Website backups and rollback

The deployment script keeps copies of existing files it replaces under `/home/mmijatov/.amigoingbroke-deploy-backups/`, outside the public website. It does not delete server-only files. Backups accumulate: periodically inspect disk usage and retain the versions needed for recovery before removing anything. There is no automatic retention cleanup.

Revert an unwanted source change and deploy again for a code rollback. A newly added file can remain on the server after a revert because deployments do not delete files. Review and remove obsolete public files separately. Website-file backups do not include browser-stored plans or Google Drive backups.

Record deployed commits and workflow run links in the changelog. A release tag can identify a milestone, but the latest GitHub commit is not necessarily the live version. Do not label an undeployed source commit as deployed.

## Original Git history

The local branch `codex/preserved-local-history` retains the original development commits from before GitHub publication. Keep it until a verified durable backup exists. The GitHub `main` history starts with the existing GitHub README commit and the published app snapshot; it does not contain all original local commits.

A full-history bundle can be created outside the public website and verified with:

```sh
git bundle create /path/outside/the/repository/amigoingbroke-history.bundle --all
git bundle verify /path/outside/the/repository/amigoingbroke-history.bundle
```

Keep a private off-machine copy. A bundle can be cloned into a new folder to inspect the preserved branches. Treat the bundle as private project data; do not add it to this repository or put it in the publicly served directory.

Direct terminal pushes currently need a separate GitHub authentication setup. Codex's connected GitHub tools can publish without exposing an access token in the repository. Avoid rewriting published history to resolve an authentication problem.

## Product backlog

The original bounded-payment implementation plan remains in [IMPROVEMENT_PLAN.md](../IMPROVEMENT_PLAN.md). Dashboard redesign, richer scenarios, compact mobile editing, and additional integrations remain ideas, not scheduled commitments.
