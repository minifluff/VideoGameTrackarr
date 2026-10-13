#!/bin/sh
set -e

# Fix ownership at runtime, not build time — see Dockerfile for why (chown under QEMU
# cross-arch emulation doesn't reliably persist into the image). Cheap and idempotent, and
# it also covers a freshly-created named volume, which always copies in with the image's
# on-disk ownership at the time this ran, not whatever chown baked into the layer.
chown -R appuser:appuser db uploads

# Fix for corrupted alembic version state from failed merge migration (2026-10-13)
# Ensure appearance columns exist and stamp to correct version
su -s /bin/sh appuser -c "python3 -c \"
import sqlite3
import os
db_path = 'db/videogametrackarr.db'
if not os.path.exists(db_path):
    # Try alternative paths
    for p in ['db/app.db', '/app/db/videogametrackarr.db', 'videogametrackarr.db']:
        if os.path.exists(p):
            db_path = p
            break
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    # Add appearance columns if missing
    cur.execute('PRAGMA table_info(users)')
    cols = [r[1] for r in cur.fetchall()]
    if 'accent_color' not in cols:
        cur.execute('ALTER TABLE users ADD COLUMN accent_color VARCHAR')
        print('Added accent_color column')
    if 'app_title' not in cols:
        cur.execute('ALTER TABLE users ADD COLUMN app_title VARCHAR')
        print('Added app_title column')
    # Clean up version table - keep only the latest applied version
    try:
        cur.execute('SELECT version_num FROM alembic_version')
        versions = [r[0] for r in cur.fetchall()]
        print(f'Current versions: {versions}')
        # If we have the bad merge version or multiple versions, fix it
        if 'm3rg3h34ds01' in versions or len(versions) > 1:
            cur.execute('DELETE FROM alembic_version')
            cur.execute(\"INSERT INTO alembic_version (version_num) VALUES ('c4d5e6f7a8b9')\")
            print('Reset version to c4d5e6f7a8b9')
    except Exception as e:
        print(f'Version check: {e}')
    conn.commit()
    conn.close()
\""

su -s /bin/sh appuser -c "alembic upgrade head"
exec su -s /bin/sh appuser -c "exec $*"
