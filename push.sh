#!/usr/bin/env bash
# Put Deckard on GitHub. Run this in Terminal.app.
set -uo pipefail
cd "$(dirname "$0")"
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
die(){ printf "\n\033[1;31m XX \033[0m %s\n" "$*"; exit 1; }

REPO="${1:-deckard}"
VIS="${2:---private}"        # pass --public as the 2nd arg to make it public

say "1/5  Checking for the GitHub CLI"
if ! command -v gh >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    say "Installing gh via Homebrew (a minute or two)"
    brew install gh || die "brew install gh failed."
  else
    die "Neither gh nor Homebrew is installed.
     Install Homebrew first:
       /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
     then re-run ./push.sh"
  fi
fi
say "gh $(gh --version | head -1 | awk '{print $3}')"

say "2/5  GitHub sign-in"
if ! gh auth status >/dev/null 2>&1; then
  say "Opening the browser to authorise. Choose HTTPS when asked."
  gh auth login --hostname github.com --git-protocol https --web || die "GitHub login failed."
fi
gh auth status 2>&1 | grep -i "logged in" | head -1

say "3/5  Committing anything outstanding"
git add -A
if ! git diff --cached --quiet; then
  git commit -q -m "Deploy scripts and project config" && say "committed"
else
  say "nothing new to commit"
fi

say "4/5  Creating the repository ($VIS)"
if git remote get-url origin >/dev/null 2>&1; then
  say "origin already set: $(git remote get-url origin)"
else
  if gh repo create "$REPO" "$VIS" --source=. --remote=origin \
       --description "Deckard - a buy-side workbench for small-business acquisitions" 2>/tmp/ghcreate.err; then
    say "created $REPO"
  elif grep -qi "already exists\|name already" /tmp/ghcreate.err; then
    OWNER=$(gh api user -q .login)
    say "$OWNER/$REPO already exists on GitHub - pointing at it instead"
    git remote add origin "https://github.com/$OWNER/$REPO.git" 2>/dev/null || \
      git remote set-url origin "https://github.com/$OWNER/$REPO.git"
  else
    cat /tmp/ghcreate.err
    die "Could not create the repo. Try a different name:  ./push.sh some-other-name"
  fi
fi

say "5/5  Pushing"
git push -u origin main || die "Push failed."

URL=$(gh repo view --json url -q .url 2>/dev/null)
printf "\n================================================\n"
printf " ON GITHUB:  %s\n" "${URL:-check github.com}"
printf " Visibility: %s\n" "${VIS#--}"
printf " To flip it public later:  gh repo edit --visibility public\n"
printf "================================================\n"
