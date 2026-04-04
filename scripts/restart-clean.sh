#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# restart-clean.sh — Tear down the unified stack, optionally remove volumes,
#                    and bring it back up with real-time logs of problem services.
#
# Usage:
#   bash scripts/restart-clean.sh              # restart, keep volumes
#   bash scripts/restart-clean.sh --purge      # restart, remove ALL volumes
###############################################################################

COMPOSE_FILE="docker-compose.unified.yml"
PROBLEM_SERVICES="groupbuy-analytics-service groupbuy-django-admin groupbuy-centrifugo groupbuy-websocket groupbuy-kafka groupbuy-zookeeper"

echo "==> Stopping all services..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

if [[ "${1:-}" == "--purge" ]]; then
  echo "==> Removing named volumes (postgres_data, redis_data, kafka_data, zookeeper_data)..."
  for vol in postgres_data redis_data kafka_data zookeeper_data; do
    vol_name=$(docker volume ls -q | grep "$vol" || true)
    if [[ -n "$vol_name" ]]; then
      docker volume rm "$vol_name" && echo "    removed $vol_name"
    fi
  done
fi

echo "==> Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "==> Waiting 10 seconds for containers to initialise..."
sleep 10

echo ""
echo "==> Container status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "==> Tailing logs for previously-problematic services (Ctrl+C to stop)..."
docker logs --tail 50 --follow $PROBLEM_SERVICES 2>&1
