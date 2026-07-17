-- Evolution Go requires two databases that are NOT created by POSTGRES_DB
-- (which only creates the single ${EVOLUTION_DB_NAME}=evolution database).
-- This init script runs on first container start (empty data dir) to create
-- the auth and users databases that Evolution Go expects via its DSNs.
--
-- For existing deployments where evolution_db_data/ already has data,
-- run these manually once (use the REAL cluster superuser from .env, NOT postgres):
--   docker exec -it risev-evolution-db psql -U waly_db_admin -c "CREATE DATABASE evogo_auth;"
--   docker exec -it risev-evolution-db psql -U waly_db_admin -c "CREATE DATABASE evogo_users;"

SELECT 'CREATE DATABASE evogo_auth'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'evogo_auth')\gexec

SELECT 'CREATE DATABASE evogo_users'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'evogo_users')\gexec