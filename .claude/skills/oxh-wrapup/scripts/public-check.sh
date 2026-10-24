#!/bin/sh
# Lists what should not be in a public repo: secrets, personal data, big files, and private words.
# Reports only; changes nothing. Run from the repo root before making the repo public.
cd "$(git rev-parse --show-toplevel)" || exit 2
found=0
say() { found=1; printf '%s\n' "$1"; }

echo "Tracked files that look like secrets or data:"
git ls-files | grep -E '(^|/)(\.env($|\.)|.*\.(pem|key|p12|pfx)$|id_(rsa|ecdsa|ed25519)|.*credentials.*\.json$|keys\.txt$)|^(data|models|recordings|private)/' \
  | grep -v '\.env\.example$' | while read -r f; do echo "  $f"; done | grep . && found=1

echo "Tracked files over 10 MB:"
git ls-files -z | xargs -0 du -k 2>/dev/null | awk '$1 > 10240 { printf "  %s (%d MB)\n", $2, $1/1024 }' | grep . && found=1

echo "Secret patterns in tracked text:"
git grep -nIE 'sk-ant-[A-Za-z0-9_-]{20,}|sk-(proj-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,}|hf_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -- . ':!.githooks/pre-commit' ':!.claude/skills/oxh-wrapup/scripts/public-check.sh' | sed 's/^/  /' | grep . && found=1

if [ -f hack/private-words.txt ]; then
  echo "Private words (hack/private-words.txt):"
  grep -vE '^\s*(#|$)' hack/private-words.txt | while read -r w; do
    git grep -nIiwF -- "$w" -- . ':!hack/private-words*.txt' | sed "s/^/  [$w] /" | head -20
  done | grep . && found=1
fi

echo "Secrets ever committed (history):"
git log --all -p --format='commit %h' 2>/dev/null | grep -nE '^\+.*(sk-ant-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' \
  | grep -v 'grep\|re.compile\|SECRETS' | head -5 | sed 's/^/  /' | grep . && found=1

echo
if [ "$found" = 1 ]; then echo "Findings above. Fix them before the repo goes public."; exit 1; fi
echo "Nothing found. Still read the README and the .claude/ notes in oxh-wrapup before going public."
