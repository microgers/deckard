#!/usr/bin/env bash
# Runs setup, and whatever happens leaves a full log + diagnostic in the folder
# so Claude can read it without you copying anything back.
cd "$(dirname "$0")"
echo "Running setup — full output is being saved to SETUP-LOG.txt"
bash ./setup.sh "$@" 2>&1 | tee SETUP-LOG.txt
STATUS=${PIPESTATUS[0]}
echo "exit status: $STATUS" >> SETUP-LOG.txt
if [ "$STATUS" -ne 0 ] || [ ! -f SETUP-RESULT.txt ]; then
  echo
  echo "Setup did not finish. Collecting a diagnostic..."
  ./diagnose.sh >/dev/null 2>&1
  echo "Done. Tell Claude 'ran go.sh' and it will read the logs."
fi
