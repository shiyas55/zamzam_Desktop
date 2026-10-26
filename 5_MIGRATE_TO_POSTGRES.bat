@echo off
cd /d "%~dp0"
call "%~dp0migrate_sqlite_to_postgres.bat"
