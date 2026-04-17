#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-http://127.0.0.1:3000}"
cloudflared tunnel --url "$TARGET_URL" --no-autoupdate
