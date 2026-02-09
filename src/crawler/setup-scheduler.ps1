# TWSE Intraday Crawler - Windows Scheduled Task Setup
# Run this script as Administrator in PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TWSE Intraday Crawler - Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$TaskName = "TWSE Intraday Crawler"
$TaskDescription = "抓取 20 檔庫存股即時行情，每 10 分鐘更新"
$ScriptPath = "C:\Users\ROOT\workspace\wk-antigravity\notebooklm\src\crawler\run-crawler.bat"
$LogPath = "C:\Users\ROOT\workspace\wk-antigravity\notebooklm\logs"

# Check if running as admin
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "⚠️  Please run this script as Administrator!" -ForegroundColor Red
    Write-Host "   Right-click PowerShell -> Run as Administrator"
    exit 1
}

# Ensure log directory exists
if (!(Test-Path $LogPath)) {
    New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
    Write-Host "✅ Created log directory: $LogPath" -ForegroundColor Green
}

# Remove existing task if exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "🗑️  Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the scheduled task
Write-Host "⏰ Creating scheduled task..." -ForegroundColor Yellow

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$ScriptPath`""

# Trigger: Daily at 09:00, repeat every 10 minutes for 5 hours (market hours 09:00-13:30)
$Trigger = New-ScheduledTaskTrigger -Daily -At "09:00"
$Trigger.RepetitionInterval = (New-TimeSpan -Minutes 10)
$Trigger.RepetitionDuration = (New-TimeSpan -Hours 5)

# Settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register the task
Register-ScheduledTask -TaskName $TaskName `
    -Description $TaskDescription `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Task Created Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Task Details:" -ForegroundColor Cyan
Write-Host "  Name: $TaskName"
Write-Host "  Schedule: Daily 09:00-14:00, every 10 minutes"
Write-Host "  Script: $ScriptPath"
Write-Host "  Logs: $LogPath"
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Start:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Stop:   Stop-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Check:  Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Remove: Unregister-ScheduledTask -TaskName '$TaskName'"
Write-Host "  GUI:    taskschd.msc"
Write-Host ""
Write-Host "Next run will start automatically at 09:00" -ForegroundColor Yellow
Write-Host "Or run manually: .\src\crawler\run-crawler.bat" -ForegroundColor Yellow
