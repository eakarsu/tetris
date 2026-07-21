#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "$0")"

: "${HOST:=127.0.0.1}"
: "${PORT:=3000}"
export HOST PORT

if [[ ! -d node_modules ]]; then
  echo "Dependencies are missing; run npm ci before start.sh." >&2
  exit 1
fi

if [[ ! -d dist ]]; then
  echo "Production build is missing; run npm run build before start.sh." >&2
  exit 1
fi

exec npm start -- --hostname "$HOST" --port "$PORT"
