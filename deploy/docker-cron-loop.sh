#!/usr/bin/env sh
set -eu

path_suffix="${1:?usage: docker-cron-loop.sh <path> <interval-seconds> [mode]}"
interval_seconds="${2:?usage: docker-cron-loop.sh <path> <interval-seconds> [mode]}"
mode="${3:-interval}"
base_url="${RELEASELOG_INTERNAL_URL:-http://app:3000}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "docker-cron-loop: CRON_SECRET is empty; refusing to call ${path_suffix}" >&2
  exit 2
fi

wait_for_app() {
  for attempt in $(seq 1 60); do
    if curl -fsS --max-time 5 "${base_url}/api/v1/entity-list" >/dev/null 2>&1; then
      return 0
    fi
    echo "docker-cron-loop: waiting for app at ${base_url} (${attempt}/60)"
    sleep 1
  done
  echo "docker-cron-loop: app did not become ready at ${base_url}; continuing anyway" >&2
}

sleep_until_weekly_monday_0900() {
  node <<'NODE'
const now = new Date();
const target = new Date(now);
const day = now.getUTCDay();
const daysUntilMonday = (8 - day) % 7;
target.setUTCDate(now.getUTCDate() + daysUntilMonday);
target.setUTCHours(9, 0, 0, 0);
if (target <= now) {
  target.setUTCDate(target.getUTCDate() + 7);
}
const seconds = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));
console.log(seconds);
NODE
}

while :; do
  if [ "$mode" = "weekly-monday-0900" ]; then
    sleep_seconds="$(sleep_until_weekly_monday_0900)"
    echo "docker-cron-loop: sleeping ${sleep_seconds}s before ${path_suffix}"
    sleep "$sleep_seconds"
  fi

  wait_for_app
  echo "docker-cron-loop: calling ${path_suffix}"
  if ! curl -fsS --max-time 120 \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "${base_url}${path_suffix}"; then
    echo "docker-cron-loop: ${path_suffix} failed" >&2
  fi
  echo

  if [ "$mode" = "weekly-monday-0900" ]; then
    continue
  fi
  sleep "$interval_seconds"
done
