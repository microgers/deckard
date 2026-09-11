#!/usr/bin/env bash
# Deckard - one-shot Firebase setup and deploy.
# Safe to re-run: every step checks before acting.
set -uo pipefail
cd "$(dirname "$0")"
FB="npx --yes firebase"
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
die(){ printf "\n\033[1;31m XX \033[0m %s\n" "$*"; exit 1; }

say "1/8  Firebase sign-in"
if ! $FB login:list 2>/dev/null | grep -q "@"; then
  if [ ! -t 0 ]; then
    die "Not signed in, and this shell has no terminal attached so the browser login cannot complete.
     Open Terminal.app and run:  cd ~/Documents/acquisition-bench && npx firebase login
     Then re-run ./setup.sh"
  fi
  $FB login || die "Login failed."
fi
ACCOUNT=$($FB login:list 2>/dev/null | grep -o "[^ ]*@[^ ]*" | head -1)
say "Signed in as ${ACCOUNT:-unknown}"

say "2/8  Project"
PROJECT="${1:-}"
if [ -z "$PROJECT" ] && [ -f .firebaserc ]; then
  PROJECT=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).projects.default||'')}catch(e){console.log('')}" 2>/dev/null)
fi
if [ -z "$PROJECT" ]; then
  PROJECT=$($FB projects:list 2>/dev/null | tr -d ' ' | grep -oE '[a-z][a-z0-9-]{4,28}-[a-z0-9]{5}|[a-z][a-z0-9-]{5,28}' | grep -vE '^(projects|firebase|preparing|display|resource|number|project)' | head -1)
  [ -n "$PROJECT" ] && say "Found existing project: $PROJECT"
fi
if [ -z "$PROJECT" ]; then
  die "No Firebase project, and the CLI could not create one.
     This is normal on a Google account that has never used Google Cloud.

     Create it in the console instead - about a minute:
       1. https://console.firebase.google.com  ->  Create a project
       2. Name it anything, skip Google Analytics
       3. While there, switch on sign-in:
          Build > Authentication > Get started > Google > Enable
          pick a support email, then Save

     Then run:   ./setup.sh YOUR-PROJECT-ID
     (the id is in the console URL, or under Project settings)"
fi
printf '{ "projects": { "default": "%s" } }\n' "$PROJECT" > .firebaserc
say "Using project: $PROJECT"

say "3/8  Web app"
APPID=$($FB apps:list WEB --project "$PROJECT" 2>/dev/null | grep -o "1:[0-9]*:web:[a-z0-9]*" | head -1)
if [ -z "$APPID" ]; then
  $FB apps:create WEB "Deckard" --project "$PROJECT" >/dev/null 2>&1
  APPID=$($FB apps:list WEB --project "$PROJECT" 2>/dev/null | grep -o "1:[0-9]*:web:[a-z0-9]*" | head -1)
fi
[ -n "$APPID" ] || die "Could not create a web app. Console: Project settings > Your apps > Web."
say "Web app: $APPID"

say "4/8  Writing .env"
$FB apps:sdkconfig WEB "$APPID" --project "$PROJECT" > ./ab-sdk.txt 2>/dev/null
node tools/write-env.mjs ./ab-sdk.txt || die "Could not parse the SDK config; see ab-sdk.txt"

say "5/8  Firestore database"
if ! $FB firestore:databases:list --project "$PROJECT" 2>/dev/null | grep -q "(default)"; then
  $FB firestore:databases:create "(default)" --location=nam5 --project "$PROJECT" 2>&1 | tail -3
fi

say "6/8  Security rules"
$FB deploy --only firestore:rules --project "$PROJECT" 2>&1 | tail -4

say "7/8  Build"
if [ "${SKIP_BUILD:-0}" = "1" ] && [ -f dist/index.html ]; then
  say "SKIP_BUILD=1 and dist/ exists - using the existing build"
else
  rm -rf dist
  npm run build > BUILD-LOG.txt 2>&1
  if [ $? -ne 0 ]; then
    tail -40 BUILD-LOG.txt
    die "Build failed. The FULL error is in BUILD-LOG.txt - send that to Claude."
  fi
  tail -3 BUILD-LOG.txt
fi

say "8/8  Deploy"
$FB deploy --only hosting --project "$PROJECT" 2>&1 | tail -6

{
  echo "PROJECT=$PROJECT"
  echo "APPID=$APPID"
  echo "ACCOUNT=${ACCOUNT:-}"
  echo "URL=https://$PROJECT.web.app"
  echo "DONE=$(date)"
} > SETUP-RESULT.txt

printf "\n================================================\n"
printf " LIVE:  https://%s.web.app\n" "$PROJECT"
printf "\n ONE STEP LEFT - turn on Google sign-in:\n"
printf " https://console.firebase.google.com/project/%s/authentication/providers\n" "$PROJECT"
printf " Get started > Google > Enable > pick a support email > Save\n"
printf "================================================\n"
