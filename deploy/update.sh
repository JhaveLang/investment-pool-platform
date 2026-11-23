#!/usr/bin/env bash
# Updates a server set up with deploy/setup.sh to the latest code: pulls, rebuilds and restarts the app. Pending
# database migrations run automatically before the new version starts.
#
#   sudo bash deploy/update.sh
set -euo pipefail

cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "Updated and healthy."
    exit 0
  fi
  sleep 3
done
echo "The app did not become healthy; see: docker compose logs app migrate" >&2
exit 1
