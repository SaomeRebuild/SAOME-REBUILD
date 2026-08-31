@echo off
REM scripts\dev-restart.cmd — .cmd shim for PowerShell execution policy.
REM Forwards all args to dev-restart.ps1 with -ExecutionPolicy Bypass.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-restart.ps1" %*
