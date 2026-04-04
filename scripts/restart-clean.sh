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
PROBLEM_SERVICES="analytics-service django-admin centrifugo websocket-server kafka zookeeper"

echo "==> Stopping all services..."
if [[ "${1:-}" == "--purge" ]]; then
  echo "==> Removing named volumes (postgres_data, redis_data, kafka_data, zookeeper_data)..."
  docker compose -f "$COMPOSE_FILE" down --remove-orphans -v
else
  docker compose -f "$COMPOSE_FILE" down --remove-orphans
fi

echo "==> Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "==> Waiting 15 seconds for containers to initialise..."
sleep 15

echo ""
echo "==> Container status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "==> Tailing logs for previously-problematic services (Ctrl+C to stop)..."
docker compose -f "$COMPOSE_FILE" logs --tail 50 --follow $PROBLEM_SERVICES
