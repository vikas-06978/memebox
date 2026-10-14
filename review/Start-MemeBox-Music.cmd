@echo off
setlocal
set "MEMEBOX_REVIEW_ROOT=%~dp0"
echo Starting the local MemeBox music room. Keep this window open.
echo No installation, Cloudflare deployment or Windows policy change is performed.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $code=[IO.File]::ReadAllText((Join-Path $env:MEMEBOX_REVIEW_ROOT 'Start-MemeBox-Music.ps1')); & ([ScriptBlock]::Create($code))"
if errorlevel 1 (
  echo Could not start the local player. Close another server on port 8790 and try again.
  pause
)
endlocal
