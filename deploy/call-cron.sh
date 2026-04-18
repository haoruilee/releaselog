#!/usr/bin/env bash
# Invoke a local ReleaseLog cron endpoint with the configured CRON_SECRET.
# Usage: call-cron.sh /api/cron/ingest
#
# Sources env from /root/releaselog/.env.local (where systemd reads it from),
# posts to 127.0.0.1:3000, and exits non-zero on non-2xx so systemd logs a failure.
set -euo pipefail

ENV_FILE="/root/releaselog/.env.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "call-cron.sh: CRON_SECRET is empty or missing from $ENV_FILE" >&2
  exit 2
fi

PATH_SUFFIX="${1:?usage: call-cron.sh <path>}"

curl -fsS --max-time 120 -o - \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://127.0.0.1:3000${PATH_SUFFIX}"
echo
