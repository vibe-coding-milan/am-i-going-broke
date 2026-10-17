# Cleanup inventory

Reviewed October 16, 2026. The project had 36 tracked files totaling 292,360 bytes before this cleanup. It has no large generated directories, installed dependencies, or financial backup files tracked in Git. This is organizational cleanup, not a significant storage reduction.

## Removed from GitHub; retained locally

The following files are removed from the current repository tree and explicitly ignored. Their local contents are preserved. They will not be included in future commits or deployment uploads unless deliberately tracked again.

| Local path, relative to the project folder | Bytes | Reason and optional local action |
| --- | ---: | --- |
| `IMPROVEMENT_PLAN.md` | 1,921 | Completed feature plan. Implementation/deployment facts are in the changelog; remaining ideas are in maintenance notes. Delete locally if the historical planning prose is no longer useful. |
| `assets/logo-full.svg` | 2,145 | Unreferenced full logo variant. Delete locally if you do not want it for future branding work. |
| `assets/logo-full-light.svg` | 2,305 | Unreferenced light full logo variant. Same optional action. |
| `assets/logo-text.svg` | 812 | Unreferenced wordmark variant. Same optional action. |
| `assets/logo-text-light.svg` | 821 | Unreferenced light wordmark variant. Same optional action. |

Total removed from tracking: **8,004 bytes**. None is referenced by the app's HTML, JavaScript, or CSS. Links in maintained documentation have been updated. For another checkout, these files disappear when pulling the removal commit; the local-copy preservation applies to the maintainer's current working folder.

You can inspect ignored files with `git status --short --ignored`. Remove the individual files manually using Finder if desired; no local deletion is needed for GitHub to remain tidy. The retired files remain recoverable from Git history, including commit `0965501` and the private history bundle recorded in [maintenance notes](./MAINTENANCE.md#original-git-history).

## Keep

- `assets/logo-icon.svg` and `assets/logo-icon-light.svg`: used by the app's theme/branding code and policy pages.
- `assets/oauth-consent-logo.png` and `assets/oauth-consent-logo-512.png`: consent-screen artwork may be configured in Google's external OAuth console. The lack of an HTML reference does not establish that these assets are obsolete. Retain both until the external configuration is confirmed.
- `projectionHealth.js`, `components/`, `content/`, and `styles/projection-answer.css`: active app dependencies, even though the code is split into several files.
- Tests, project checks, deployment scripts, `.github/`, policy pages, and maintenance documentation: part of operating the project.
- `.local-backups/history-0965501-20261016.bundle`: ignored local recovery copy, about 156 kB. Keep unless intentionally relying on the verified off-machine copy.
- `.git/` and `codex/preserved-local-history`: version control and original development history, not disposable build output.

## Already excluded from GitHub

`.DS_Store` is macOS Finder metadata. It can be deleted locally if desired, but Finder may recreate it. It is already ignored. Private-key patterns, `.env` files, history bundles, local backups, and `node_modules/` are also excluded by `.gitignore`.

## Git history and the live website

Removing a tracked file cleans up the current GitHub tree; it does not erase historical commits or reclaim all historical storage. No history rewrite or force push is part of this cleanup. The repository is too small to justify that disruption for space savings.

DreamHost deployment deliberately preserves server-only files. Retired logo files that were uploaded in the past may remain on the live server; no live-server deletion was performed. Confirm that no external service uses those URLs before any separate server cleanup. The current repository cleanup does not require redeploying the app.
