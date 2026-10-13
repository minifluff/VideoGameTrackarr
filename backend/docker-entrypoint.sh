#!/bin/sh
set -e

chown -R appuser:appuser db uploads

# Fix for corrupted alembic version state from failed merge migration (2026-10-13)
su -s /bin/sh appuser -c '/usr/local/bin/python3 /app/fix_db.py || true'

su -s /bin/sh appuser -c "alembic upgrade head"
exec su -s /bin/sh appuser -c "exec $*"
