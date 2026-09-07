#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Run LYBOR on this machine (macOS / Linux).
#
#  Installs dependencies and sets up the database only if they are missing,
#  then starts the server. Leave the terminal open while you use the app;
#  Ctrl+C stops it.
#
#  Make it executable once:  chmod +x start-lybor.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

printf '\n  Starting LYBOR...\n\n'

if ! command -v node >/dev/null 2>&1; then
  printf '  Node.js is not installed, or is not on your PATH.\n\n'
  printf '  Install the LTS version from https://nodejs.org and run this again.\n\n'
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  [1/3] Installing dependencies. This takes a minute the first time..."
  npm install
else
  echo "  [1/3] Dependencies already installed."
fi

if [ ! -f dev.db ]; then
  echo "  [2/3] Setting up the database and demo data..."
  npm run setup
else
  echo "  [2/3] Database already set up."
fi

cat <<'BANNER'
  [3/3] Starting the server on http://localhost:3000

  ---------------------------------------------------------------
    Open:  http://localhost:3000

    Sign in with any of these. Password for all: lybor123
      Worker     9800000001
      Employer   9800000010
      Admin      9800000099

    Keep this terminal open. Press Ctrl+C to stop the server.
  ---------------------------------------------------------------

BANNER

# Open the browser once the server has had a moment to bind.
(
  sleep 6
  if command -v open >/dev/null 2>&1; then
    open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000 >/dev/null 2>&1
  fi
) &

exec npm run dev
