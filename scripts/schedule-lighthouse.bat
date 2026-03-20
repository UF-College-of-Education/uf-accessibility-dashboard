@echo off
REM Schedule Lighthouse audit to run every Friday at 10:00 AM
REM Run this script ONCE as administrator to set up the schedule

schtasks /create /tn "Lighthouse Accessibility Audit" /tr "cmd /c cd /d %~dp0.. && node scripts/lighthouse-audit.mjs && git add public/lighthouse-scores.json && git commit -m \"Update Lighthouse scores\" && git push" /sc weekly /d FRI /st 10:00 /f

echo.
echo Scheduled task created: "Lighthouse Accessibility Audit"
echo Runs every Friday at 10:00 AM
echo.
pause
