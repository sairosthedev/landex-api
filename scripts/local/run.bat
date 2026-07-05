@echo off
setlocal
cd /d "%~dp0..\.."

if not exist .env (
  echo Copying .env.example to .env — set all values before running.
  copy .env.example .env >nul
)

echo Starting LandEx MERN API (config from .env)...
npm run dev
