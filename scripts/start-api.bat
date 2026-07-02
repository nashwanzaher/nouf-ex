@echo off
set DATABASE_URL=postgresql://noufex_app:NpEx_BGBdZ9BMXjcjUWXD1NFag6m04exxyckS@localhost:5432/noufex_db
set DB_SSL=false
set NODE_ENV=production
set API_PORT=3000
set HOST=0.0.0.0
set SERVE_STATIC=true
set AUTH_SECRET=C2i7vUIjGgtoPjsnaVy3GUVzVttX6-f72AcSYJOixKI
set ALLOWED_ORIGINS=*
set STATIC_PATH=c:\Users\zaher\Desktop\nouf-ex\app\dist
set PATH=C:\Users\zaher\AppData\Local\Programs\nodejs;%PATH%
cd /d c:\Users\zaher\Desktop\nouf-ex\app
.\node_modules\.bin\tsx.cmd server/index.ts
