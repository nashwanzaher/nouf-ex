@echo off
set PATH=C:\Users\zaher\AppData\Local\Programs\nodejs;%PATH%
cd /d c:\Users\zaher\Desktop\nouf-ex\app
.\node_modules\.bin\esbuild.cmd server\index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=server\index.cjs --packages=external
