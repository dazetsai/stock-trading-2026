@echo off
REM Quick test script for TWSE Intraday Crawler
echo ========================================
echo TWSE Intraday Crawler - Quick Test
echo ========================================
echo.
echo Starting test run...
echo.

cd /d C:\Users\ROOT\workspace\wk-antigravity\notebooklm
node src\crawler\intraday-crawler.js --once

echo.
echo ========================================
echo Checking output files...
echo ========================================
dir /b data\intraday\intraday_latest.* 2>nul

echo.
echo ========================================
echo Test completed!
echo ========================================
pause
