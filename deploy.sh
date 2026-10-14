#!/usr/bin/env bash
#
# Deploy the web app to chartthegame.com. The runbook, the account model and
# the one-time setup are in docs/HOSTING.md; this is the everyday wrapper.
#
#   ./deploy.sh                  check, export, upload, invalidate the CDN
#   ./deploy.sh --fast           the same without typecheck and tests
#   ./deploy.sh -y               don't ask, even on a dirty tree or off main
#   ./deploy.sh --dry-run        say what would happen, change nothing
#   ./deploy.sh infra            create/update the stack (as chartthegame-admin)
#   ./deploy.sh infra --domain   ...plus the certificate and the domain records
#   ./deploy.sh status           print the stack outputs
#
# Uploads run as the scoped `chartthegame` profile, stack changes as
# `chartthegame-admin`; pass --profile to either to override.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

SITE_URL='https://chartthegame.com'
CDN_URL='https://d1mwqpml5qkmi5.cloudfront.net'

# `shift` with nothing to shift fails under `set -e`, so only shift a real subcommand.
command=site
case "${1:-}" in
  site | infra | status)
    command=$1
    shift
    ;;
  '' | -*) ;; # flags only, or nothing at all
  *)
    echo "usage: ./deploy.sh [site|infra|status] [--fast] [-y] [--dry-run] [--domain] [--profile <p>]" >&2
    exit 2
    ;;
esac

# Flags this script handles; everything else passes to scripts/deploy-web.mjs.
fast=false
assume_yes=false
dry_run=false
passthrough=()
for arg in "$@"; do
  case "$arg" in
    --fast) fast=true ;;
    -y | --yes) assume_yes=true ;;
    --dry-run) dry_run=true ;;
    *) passthrough+=("$arg") ;;
  esac
done

run() {
  if [[ $dry_run == true ]]; then
    echo "would run: $*"
  else
    "$@"
  fi
}

if [[ $command != site ]]; then
  run node scripts/deploy-web.mjs "$command" ${passthrough[@]+"${passthrough[@]}"}
  exit 0
fi

# --- What is about to go live -----------------------------------------------

branch=$(git rev-parse --abbrev-ref HEAD)
echo "Branch:  $branch"
echo "Commit:  $(git log -1 --format='%h %s')"

confirm() {
  if [[ $assume_yes == true ]]; then return 0; fi
  # Non-interactive (CI, a pipe) never prompts: pass -y or it stops here.
  if [[ ! -t 0 ]]; then
    echo "Refusing without -y: $1" >&2
    exit 1
  fi
  read -r -p "$1 Continue? [y/N] " reply
  [[ $reply == [yY] ]] || exit 1
}

if [[ -n $(git status --porcelain) ]]; then
  git status --short
  confirm "Working tree is dirty; those changes ship too."
fi

if [[ $branch != main ]]; then
  confirm "Deploying $branch, not main."
fi

# --- Checks ------------------------------------------------------------------

if [[ $fast == true ]]; then
  echo "Skipping typecheck and tests (--fast)."
else
  echo "Typechecking..."
  run npm run --silent typecheck
  echo "Testing..."
  run npm run --silent test
fi

# --- Ship --------------------------------------------------------------------

run node scripts/deploy-web.mjs site ${passthrough[@]+"${passthrough[@]}"}
if [[ $dry_run == true ]]; then exit 0; fi

# --- Did it land? ------------------------------------------------------------
# The CDN URL always answers; the domain only once `infra --domain` has run.

for url in "$CDN_URL" "$SITE_URL"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo '---')
  printf '%-40s %s\n' "$url" "$code"
done

echo
echo "A deployed build migrates an older saved document on load, but never the"
echo "other way: don't roll back past the version-2 document (docs/HOSTING.md)."
