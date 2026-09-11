#!/usr/bin/env bash
# Writes a report to DIAGNOSE.txt that Claude can read from the shared folder.
cd "$(dirname "$0")"
OUT=DIAGNOSE.txt
{
  echo "when: $(date)"
  echo "tty: $([ -t 0 ] && echo interactive || echo NON-INTERACTIVE)"
  echo "shell: $SHELL"
  echo "home: $HOME"
  echo "node: $(node -v 2>&1)"
  echo
  echo "--- firebase login:list ---"
  npx --yes firebase login:list 2>&1 | head -10
  echo
  echo "--- credential store ---"
  for f in "$HOME/.config/configstore/firebase-tools.json" "$HOME/Library/Preferences/configstore/firebase-tools.json"; do
    if [ -f "$f" ]; then
      echo "FOUND $f"
      node -e "const c=require('$f'); console.log('  has tokens:', !!c.tokens, '| user:', (c.user&&c.user.email)||'none')" 2>&1
    else
      echo "missing $f"
    fi
  done
  echo
  echo "--- can this shell reach Google? ---"
  for u in https://firebase.googleapis.com/ https://www.googleapis.com/; do
    printf "  %-38s %s\n" "$u" "$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$u" 2>&1)"
  done
  echo
  echo "--- projects ---"
  npx --yes firebase projects:list 2>&1 | head -12
} > "$OUT" 2>&1
echo "wrote $OUT"
cat "$OUT"
