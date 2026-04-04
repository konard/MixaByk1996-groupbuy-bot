#!/bin/bash
# init-databases.sh — creates all required databases in a single PostgreSQL instance
# Used by docker-compose.light.yml as an init script
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE purchase_db;
    CREATE DATABASE payment_db;
    CREATE DATABASE chat_db;
    CREATE DATABASE reputation_db;
EOSQL

echo "All databases created successfully."
