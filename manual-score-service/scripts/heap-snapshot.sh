#!/usr/bin/env bash
PID=$1
if [ -z "$PID" ]; then
  echo "Usage: npm run heap-snapshot -- <pid>"
  echo "Get PID from: ps aux | grep 'node.*src/index.ts' or 'docker top manual-score-service'"
  exit 1
fi
kill -USR2 "$PID" && echo "Sent SIGUSR2 to PID $PID. Heap snapshot written to process cwd."
