#!/usr/bin/env bash
# Deckard — flip repo public, provision the new Firebase project, build, deploy, push.
set -uo pipefail
cd "$(dirname "$0")"
g(){ printf '\n\033[32m==>\033[0m %s\n' "$*"; }
r(){ printf '\n\033[31m XX \033[0m %s\n' "$*"; }

PROJECT=deckard-app

g "1/6  Making the GitHub repo public"
gh repo edit microgers/deckard --visibility public --accept-visibility-change-consequences \
  && echo "   repo is public" || r "could not flip visibility (do it at github.com/microgers/deckard/settings)"

g "2/6  Creating the Firestore database on $PROJECT"
npx -y firebase-tools firestore:databases:create "(default)" \
    --location=nam5 --project "$PROJECT" 2>&1 | tail -5 \
  || echo "   (already exists or created above — continuing)"

g "3/6  Building"
build(){ npm run build > BUILD-LOG.txt 2>&1; }
build
if [ $? -ne 0 ]; then
  if grep -q "Cannot find module .@rolldown/binding\|rolldown-binding" BUILD-LOG.txt; then
    g "    native rolldown binary is missing — reinstalling dependencies"
    rm -rf node_modules package-lock.json
    npm install 2>&1 | tail -5
    g "    rebuilding"
    build
  fi
fi
if [ $? -ne 0 ]; then
  r "Build failed. Full log is in BUILD-LOG.txt — send it to Claude."
  tail -30 BUILD-LOG.txt
  exit 1
fi
echo "   build ok"

g "4/6  Deploying rules + hosting to $PROJECT"
npx -y firebase-tools deploy --only firestore:rules,hosting --project "$PROJECT" 2>&1 | tail -25

g "5/6  Committing"
git add -A
git commit -q -m "Point Deckard at the deckard-app Firebase project" 2>/dev/null || echo "   nothing new to commit"

g "6/6  Pushing"
git push -q origin main && echo "   pushed" || r "push failed"

echo
echo "================================================"
echo " LIVE:  https://deckard-app.web.app"
echo " REPO:  https://github.com/microgers/deckard"
echo "================================================"
