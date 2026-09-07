#!/usr/bin/env bash
set -euo pipefail

PG_BIN="/usr/lib/postgresql/18/bin"
PG_DATA_ROOT="${XDG_DATA_HOME:-${HOME}/.local/share}/english-training-postgres"
PG_LOG_FILE="/tmp/english-training-postgres.log"
PG_OPTIONS="-p 55432 -k /tmp -h 127.0.0.1"

case "${1:-status}" in
  start)
    "${PG_BIN}/pg_ctl" -D "${PG_DATA_ROOT}" -l "${PG_LOG_FILE}" -o "${PG_OPTIONS}" start
    ;;
  stop)
    "${PG_BIN}/pg_ctl" -D "${PG_DATA_ROOT}" stop -m fast
    ;;
  status)
    "${PG_BIN}/pg_ctl" -D "${PG_DATA_ROOT}" status
    ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 2
    ;;
esac
