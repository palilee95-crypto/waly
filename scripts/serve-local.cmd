@echo off
REM ---------------------------------------------------------------
REM Serve a local PocketBase for testing.
REM Uses the REAL hooks + migrations so behaviour matches production.
REM
REM Data dir: pb_data_local  (gitignored). Seed it once from a prod DB
REM snapshot with vps_export_backup(backup_type="db_only"), extract the
REM data.db into pb_data_local\, then create a test superuser:
REM   pocketbase.exe superuser create localtest@risev.com password123 --dir pb_data_local
REM
REM URL:       http://127.0.0.1:8090
REM Admin UI:  http://127.0.0.1:8090/_/
REM ---------------------------------------------------------------
cd /d "%~dp0.."
pocketbase.exe serve --dir pb_data_local --http 127.0.0.1:8090 --hooksDir pb_hooks --migrationsDir pb_migrations
