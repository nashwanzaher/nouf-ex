@echo off
setlocal
set NODE_ENV=production
set DATABASE_URL=postgresql://postgres:656650@127.0.0.1:5435/noufex_clean_verify
set API_PORT=3001
set AUTH_SECRET=test-secret-must-be-at-least-32-chars-long-xyz123
set REDIS_URL=
set RABBITMQ_URL=
set ELASTICSEARCH_URL=
set SENTRY_DSN=
set OTEL_EXPORTER_OTLP_ENDPOINT=
set PUBLIC_FRONTEND_URL=https://noufex.local
set DB_SSL=false
set LOG_LEVEL=info
cd /d "C:\Users\zaher\Documents\Projects\nouf-ex"
node apps\api\dist\index.js
