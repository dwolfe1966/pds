#!/usr/bin/env bash
set -euo pipefail

PORT="${SEO_SMOKE_PORT:-3005}"
BASE="${SEO_SMOKE_BASE:-http://localhost:${PORT}}"
LOG="${TMPDIR:-/tmp}/idlookup-seo-smoke-next.log"
CURL_BIN="${CURL_BIN:-$(command -v curl || true)}"

if [[ -z "$CURL_BIN" ]]; then
  echo "curl is required for smoke checks." >&2
  exit 1
fi

if [[ ! -f ".next/BUILD_ID" ]]; then
  echo "Missing .next build output. Run: npm run build" >&2
  exit 1
fi

rm -f "$LOG"
node node_modules/next/dist/bin/next start -p "$PORT" -H 127.0.0.1 >"$LOG" 2>&1 &
PID=$!

cleanup() {
  kill "$PID" >/dev/null 2>&1 || true
  wait "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in {1..80}; do
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "next start exited before smoke checks could run." >&2
    tail -80 "$LOG" >&2 || true
    exit 1
  fi
  if "$CURL_BIN" -fsS "$BASE/" >/dev/null 2>&1; then
    SEO_SMOKE_BASE="$BASE" CURL_BIN="$CURL_BIN" node scripts/smoke.mjs
    exit $?
  fi
  sleep 0.25
done

echo "Timed out waiting for $BASE" >&2
tail -80 "$LOG" >&2 || true
exit 1
