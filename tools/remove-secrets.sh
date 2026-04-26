#!/usr/bin/env bash
set -euo pipefail

# remove-secrets.sh
# Safe helper to remove .env and common secret strings from git history.
# This script will only perform a rewrite if you pass --run and will only
# force-push if you pass --push. By default it performs a dry run and prints
# the commands you should run manually.

usage() {
  cat <<'USAGE'
Usage: remove-secrets.sh [--run] [--push]

Options:
  --run    Actually run the history rewrite (requires git-filter-repo or BFG)
  --push   Force-push rewritten branches to origin (destructive)

This will rewrite history to remove the .env file and common API token patterns.
It is destructive to history. Make a backup first (git clone --mirror ...).
USAGE
}

DO_RUN=0
DO_PUSH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run) DO_RUN=1; shift;;
    --push) DO_PUSH=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

echo "This script will remove .env and several secret patterns from git history."
echo "Make a mirror backup first:"
echo "  git clone --mirror $(git remote get-url origin) repo-backup.git"

if [[ $DO_RUN -ne 1 ]]; then
  echo "Dry run mode. To perform the rewrite, re-run with --run."
  exit 0
fi

# Ensure working tree is clean
if [[ -n $(git status --porcelain) ]]; then
  echo "Please commit or stash your working tree before running this script." >&2
  exit 1
fi

if command -v git-filter-repo >/dev/null 2>&1; then
  echo "Using git-filter-repo to remove files and token patterns..."
  # Remove file paths
  git filter-repo --invert-paths --paths .env --replace-refs delete-no-add

  # Remove common token patterns (example: sk-..., CLOUDFLARE_API_TOKEN)
  # This uses --replace-text to scrub values; create a temporary map file.
  TMPMAP=$(mktemp)
  cat > "$TMPMAP" <<EOF
regex:sk-[A-Za-z0-9_-]{20,}
replacement:[REDACTED-SK]
regex:CLOUDFLARE_API_TOKEN=[^\n\r]+\n
replacement:CLOUDFLARE_API_TOKEN=[REDACTED]\n
regex:OPENROUTER_API_KEY=[^\n\r]+\n
replacement:OPENROUTER_API_KEY=[REDACTED]\n
EOF

  git filter-repo --replace-text "$TMPMAP"
  rm -f "$TMPMAP"

elif command -v bfg >/dev/null 2>&1; then
  echo "Using BFG to remove .env and token-like strings..."
  # BFG requires a bare mirror clone. The user must run that beforehand.
  echo "Run: git clone --mirror <repo> repo-mirror.git"
  echo "Then: bfg --delete-files .env repo-mirror.git"
  echo "Then follow BFG instructions to push rewritten history."
  exit 1
else
  echo "No git-history scrub tool found (git-filter-repo or bfg). Install git-filter-repo and re-run."
  exit 1
fi

echo "History rewrite complete locally."
if [[ $DO_PUSH -eq 1 ]]; then
  read -p "Are you sure you want to force-push ALL branches to origin? This is destructive (yes/no): " yn
  if [[ "$yn" == "yes" ]]; then
    echo "Force-pushing refs to origin..."
    git push --force --all
    git push --force --tags
    echo "Force-push complete. Inform collaborators to re-clone or reset their clones."
  else
    echo "Push canceled. Review history locally before pushing.";
  fi
else
  echo "Not pushing changes. Inspect the rewritten history locally."
fi

echo "Done."
