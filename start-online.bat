@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Installe Node.js puis relance ce fichier :
  echo https://nodejs.org
  pause
  exit /b 1
)
echo.
echo 1. Laisse cette fenetre ouverte.
echo 2. Toi : ouvre http://127.0.0.1:8082
echo 3. Pour tes potes A DISTANCE, ouvre un autre terminal et tape :
echo      cloudflared tunnel --url http://127.0.0.1:8082
echo    puis envoie-leur le lien https qui s'affiche.
echo    Telechargement : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
echo 4. Multi 24/7 : voir boutique\MULTI-EN-LIGNE.txt (Render).
echo.
node server.js
pause
