#!/bin/sh
# Sidecar: poll HEAP_DUMP_DIR for *.heapsnapshot files and upload to S3 via AWS CLI.
#
# Env:
#   HEAP_DUMP_DIR          - Directory to watch (default /heapdumps)
#   HEAP_DUMP_S3_BUCKET    - Target bucket (required for upload; set per env in deploy)
#   HEAP_DUMP_SERVICE_NAME - Service segment in S3 key (default manual-score-service)
#   POD_NAME               - Pod name for unique object names (default hostname)
#   HEAP_DUMP_VERSION, DD_VERSION - Version segment in object name (optional)
#   HEAP_DUMP_POLL_INTERVAL - Poll seconds (default 5)

HEAP_DUMP_DIR="${HEAP_DUMP_DIR:-/heapdumps}"
SERVICE="${HEAP_DUMP_SERVICE_NAME:-manual-score-service}"
# Strip accidental slashes from service segment
SERVICE=$(echo "$SERVICE" | tr -d '/')
POD_NAME="${POD_NAME:-$HOSTNAME}"
VERSION="${HEAP_DUMP_VERSION:-${DD_VERSION:-unknown}}"
POLL_INTERVAL="${HEAP_DUMP_POLL_INTERVAL:-5}"

log() { echo "$(date '+%Y-%m-%dT%H:%M:%S') $*"; }

if [ -z "$HEAP_DUMP_S3_BUCKET" ]; then
  log "HEAP_DUMP_S3_BUCKET not set; sidecar will watch but not upload"
fi

while true; do
  if [ -n "$HEAP_DUMP_S3_BUCKET" ] && [ -d "$HEAP_DUMP_DIR" ]; then
    for f in "$HEAP_DUMP_DIR"/*.heapsnapshot; do
      [ -f "$f" ] || continue
      filename=$(basename "$f")
      datetime=$(date '+%Y%m%d-%H%M%S')
      object_name="${POD_NAME}_v${VERSION}_${datetime}_${filename}"
      # s3://bucket/heap_dump/<service>/<unique_heap_dump_file>
      key="heap_dump/${SERVICE}/${object_name}"
      if aws s3 cp "$f" "s3://${HEAP_DUMP_S3_BUCKET}/${key}"; then
        log "Uploaded heap dump to s3://${HEAP_DUMP_S3_BUCKET}/${key}"
        rm -f "$f"
      else
        log "Failed to upload $f to s3://${HEAP_DUMP_S3_BUCKET}/${key}"
      fi
    done
  fi
  sleep "$POLL_INTERVAL"
done
