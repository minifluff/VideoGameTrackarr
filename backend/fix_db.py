import sqlite3
import os

db_paths = ['db/videogametrackarr.db', 'db/app.db', '/app/db/videogametrackarr.db', 'videogametrackarr.db']
db_path = None
for p in db_paths:
    if os.path.exists(p):
        db_path = p
        break

if db_path:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('PRAGMA table_info(users)')
    cols = [r[1] for r in cur.fetchall()]
    if 'accent_color' not in cols:
        cur.execute('ALTER TABLE users ADD COLUMN accent_color VARCHAR')
        print('Added accent_color column')
    if 'app_title' not in cols:
        cur.execute('ALTER TABLE users ADD COLUMN app_title VARCHAR')
        print('Added app_title column')
    try:
        cur.execute('SELECT version_num FROM alembic_version')
        versions = [r[0] for r in cur.fetchall()]
        print(f'Current versions: {versions}')
        if 'm3rg3h34ds01' in versions or len(versions) > 1:
            cur.execute('DELETE FROM alembic_version')
            cur.execute("INSERT INTO alembic_version (version_num) VALUES ('c4d5e6f7a8b9')")
            print('Reset version to c4d5e6f7a8b9')
    except Exception as e:
        print(f'Version check: {e}')
    conn.commit()
    conn.close()
else:
    print('Database not found, skipping fix')
