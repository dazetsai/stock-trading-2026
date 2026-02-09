@echo off
REM TWSE Intraday Crawler Scheduler
REM Runs every 10 minutes during market hours (09:00-13:30)
REM 
REM Installation:
REM 1. Open Task Scheduler (taskschd.msc)
REM 2. Create Basic Task
REM 3. Name: "TWSE Intraday Crawler"
REM 4. Trigger: Daily at 09:00, repeat every 10 minutes for 5 hours
REM 5. Action: Start a program
REM 6. Program: C:\Windows\System32\cmd.exe
REM 7. Arguments: /c "C:\Users\ROOT\workspace\wk-antigravity\notebooklm\src\crawler\run-crawler.bat"
REM
REM Or run manually: .\run-crawler.bat

cd /d C:\Users\ROOT\workspace\wk-antigravity\notebooklm

REM Check if market is open (09:00 - 13:30)
for /f "tokens=1-2 delims=:" %%a in ('"%time%"') do (
    set /a hour=%%a
    set /a min=%%b
)

set /a currentTime=%hour%*100 + %min%

if %currentTime% LSS 900 (
    echo [%date% %time%] Market not open yet. Exiting.
    exit /b 0
)

if %currentTime% GTR 1330 (
    echo [%date% %time%] Market closed. Exiting.
    exit /b 0
)

echo [%date% %time%] Starting TWSE Intraday Crawler...
node src\crawler\intraday-crawler.js --once >> logs\crawler.log 2>&1

echo [%date% %time%] Crawler completed with exit code %errorlevel%
