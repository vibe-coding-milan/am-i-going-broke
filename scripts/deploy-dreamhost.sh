#!/usr/bin/env bash
set -euo pipefail

mode="${1:-preview}"
case "$mode" in
  preview|deploy) ;;
  *) echo 'Usage: bash scripts/deploy-dreamhost.sh [preview|deploy]' >&2; exit 1 ;;
esac

: "${DREAMHOST_KEY_FILE:?Set DREAMHOST_KEY_FILE to the deployment private key path}"
: "${DREAMHOST_KNOWN_HOSTS_FILE:?Set DREAMHOST_KNOWN_HOSTS_FILE to the verified server key file}"
: "${DREAMHOST_HOST:?Set DREAMHOST_HOST in private deployment configuration}"
: "${DREAMHOST_USER:?Set DREAMHOST_USER in private deployment configuration}"
: "${DREAMHOST_WEB_ROOT:?Set DREAMHOST_WEB_ROOT in private deployment configuration}"
: "${DREAMHOST_BACKUP_ROOT:?Set DREAMHOST_BACKUP_ROOT in private deployment configuration}"
cd "$(git rev-parse --show-toplevel)"

[[ "$DREAMHOST_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || { echo 'Invalid deployment hostname' >&2; exit 1; }
[[ "$DREAMHOST_USER" =~ ^[A-Za-z0-9_][A-Za-z0-9_-]*$ ]] || { echo 'Invalid deployment username' >&2; exit 1; }
for directory in "$DREAMHOST_WEB_ROOT" "$DREAMHOST_BACKUP_ROOT"; do
  [[ "$directory" =~ ^/[A-Za-z0-9_./-]+$ && "$directory" != / ]] || { echo 'Invalid deployment directory' >&2; exit 1; }
done
test -s "$DREAMHOST_KEY_FILE"
test -s "$DREAMHOST_KNOWN_HOSTS_FILE"
destination="${DREAMHOST_USER}@${DREAMHOST_HOST}"
website="${DREAMHOST_WEB_ROOT%/}"
release="${GITHUB_RUN_ID:-local-$(date -u +%Y%m%dT%H%M%SZ)}-${GITHUB_RUN_ATTEMPT:-1}"
backup="${DREAMHOST_BACKUP_ROOT%/}/$release"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

# Only tracked public app files are eligible. Never upload the repository itself.
git ls-files -z -- index.html privacy.html terms.html styles.css app.js projectionHealth.js driveSync.js driveSyncUI.js driveConnection.js assets components content styles api/drive-sync.php server/DriveSyncService.php server/.htaccess |
  while IFS= read -r -d '' file; do
    case "$file" in
      *.html|*.css|*.js|*.svg|*.png|*.jpg|*.jpeg|*.webp|*.ico|*.woff|*.woff2|api/drive-sync.php|server/DriveSyncService.php|server/.htaccess) ;;
      *) echo "Unexpected file in public directories: $file" >&2; exit 1 ;;
    esac
    mkdir -p "$staging/$(dirname "$file")"
    cp "$file" "$staging/$file"
  done
for file in index.html privacy.html terms.html styles.css app.js projectionHealth.js; do
  test -s "$staging/$file"
done

ssh_options=(-i "$DREAMHOST_KEY_FILE" -F /dev/null -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$DREAMHOST_KNOWN_HOSTS_FILE"
  -o ConnectTimeout=20)
ssh "${ssh_options[@]}" "$destination" "test -d '$website' && test -w '$website'"
printf -v transport '%q ' ssh "${ssh_options[@]}"

# Keep server-only files, and back up any existing file before replacing it.
options=(-rcz --itemize-changes --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r --backup --backup-dir="$backup")
if [[ "$mode" == preview ]]; then
  options+=(--dry-run)
  echo 'PREVIEW ONLY: no website files will be changed.'
else
  echo 'Deploying public files with private backups of replaced files.'
fi
rsync "${options[@]}" -e "$transport" "$staging/" "$destination:$website/"

if [[ "$mode" == deploy ]]; then
  for page in '' privacy.html terms.html; do
    curl --fail --silent --show-error --retry 2 --max-time 30 \
      "https://amigoingbroke.me/$page?deployment=$release" -o /dev/null
  done
  echo 'Deployment finished; the homepage, privacy page, and terms page responded successfully.'
fi
