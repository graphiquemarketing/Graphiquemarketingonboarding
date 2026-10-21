#!/usr/bin/env bash
# Levanta un Postgres 16 temporal, aplica las migraciones con stubs de Supabase y corre las pruebas SQL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUNAS=""
if [ "$(id -u)" = "0" ]; then chown -R postgres "$TMP"; RUNAS="runuser -u postgres --"; fi
cleanup() { $RUNAS "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
$RUNAS "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" start >/dev/null
PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "· migración $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do echo "· prueba $(basename "$f")"; "${PSQL[@]}" -f "$f" 2>&1 | sed -n 's/^.*NOTICE:  /  /p;/==/p;/ERROR/p'; done
