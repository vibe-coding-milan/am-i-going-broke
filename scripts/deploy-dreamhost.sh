#!/usr/bin/env bash
set -euo pipefail

mode="${1:-preview}"
case "$mode" in
  preview|deploy) ;;
  *) echo 'Usage: bash scripts/deploy-dreamhost.sh [preview|deploy]' >&2; exit 1 ;;
esac

: "${DREAMHOST_KEY_FILE:?Set DREAMHOST_KEY_FILE to the deployment private key path}"
cd "$(git rev-parse --show-toplevel)"

destination='mmijatov@iad1-shared-b8-06.dreamhost.com'
website='/home/mmijatov/amigoingbroke.me'
release="${GITHUB_RUN_ID:-local-$(date -u +%Y%m%dT%H%M%SZ)}-${GITHUB_RUN_ATTEMPT:-1}"
backup="/home/mmijatov/.amigoingbroke-deploy-backups/$release"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

# Only tracked public app files are eligible. Never upload the repository itself.
git ls-files -z -- index.html privacy.html terms.html styles.css app.js projectionHealth.js assets components content styles |
  while IFS= read -r -d '' file; do
    case "$file" in
      *.html|*.css|*.js|*.svg|*.png|*.jpg|*.jpeg|*.webp|*.ico|*.woff|*.woff2) ;;
      *) echo "Unexpected file in public directories: $file" >&2; exit 1 ;;
    esac
    mkdir -p "$staging/$(dirname "$file")"
    cp "$file" "$staging/$file"
  done
for file in index.html privacy.html terms.html styles.css app.js projectionHealth.js; do
  test -s "$staging/$file"
done

ssh_options=(-i "$DREAMHOST_KEY_FILE" -F /dev/null -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile=scripts/dreamhost_known_hosts
  -o ConnectTimeout=20)
ssh "${ssh_options[@]}" "$destination" "test -d '$website' && test -w '$website'"
printf -v transport '%q ' ssh "${ssh_options[@]}"

# Keep server-only files, and back up any existing file before replacing it.
options=(-rcz --itemize-changes --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r --backup --backup-dir="$backup")
if [[ "$mode" == preview ]]; then
  options+=(--dry-run)
  echo 'PREVIEW ONLY: no website files will be changed.'
else
  echo "Deploying public files. Replaced files will be backed up in $backup"
fi
rsync "${options[@]}" -e "$transport" "$staging/" "$destination:$website/"

if [[ "$mode" == deploy ]]; then
  for page in '' privacy.html terms.html; do
    curl --fail --silent --show-error --retry 2 --max-time 30 \
      "https://amigoingbroke.me/$page?deployment=$release" -o /dev/null
  done
  echo 'Deployment finished; the homepage, privacy page, and terms page responded successfully.'
fi
