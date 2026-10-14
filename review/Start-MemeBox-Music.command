#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 start-music.py
fi
printf '%s\n' 'Python 3 is required for this launcher. The Chrome review extension and listen.html work without it.'
exit 1
