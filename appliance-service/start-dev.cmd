@echo off
setlocal

set "NODE_EXE="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE (
  for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
)

if not defined NODE_EXE (
  echo Node.js was not found. Install Node.js 20 or newer, then try again.
  exit /b 1
)

"%NODE_EXE%" "%~dp0scripts\dev.js"
