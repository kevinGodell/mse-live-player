@echo off
TASKKILL /F /T /FI "WINDOWTITLE eq cctv"
TASKKILL /F /FI "WINDOWTITLE eq player"
START /REALTIME "cctv" "node" "C:\Users\%username%\IdeaProjects\mse-live-player\server.js"
TIMEOUT /T 4
START /REALTIME "player" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --profile-directory=Default --app-id=hbblfifohofgngfbjbiimbbcimepbdcb