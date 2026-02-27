@echo off
setlocal enabledelayedexpansion

:: Check for tsc (equivalent to which)
where tsc >nul 2>nul
if %errorlevel% neq 0 (
    echo tsc not found, installing globally...
    call npm install -g typescript
)

:: Get manifesto-3d
cd libs

set FIRST_TIME=0
set BUILD_NEEDED=0

:: 1. Check if the repo exists
if not exist "manifesto-3d\.git" (
    set FIRST_TIME=1
    set BUILD_NEEDED=1
    echo manifesto-3d not found, cloning...
    git clone https://github.com/treevar/manifesto-3d.git manifesto-3d
)

:: 2. Check for updates if not the first time
if %FIRST_TIME%==0 (
    echo manifesto-3d found, checking for updates...
    
    :: Capture pull output to check for "Already up to date"
    set "PULL_OUTPUT="
    for /f "delims=" %%i in ('git -C "manifesto-3d" pull 2^>^&1') do (
        set "PULL_OUTPUT=!PULL_OUTPUT! %%i"
    )

    echo !PULL_OUTPUT! | findstr /C:"Already up to date." >nul
    if errorlevel 1 (
        set BUILD_NEEDED=1
    )
)

:: 3. Build manifesto-3d
if %BUILD_NEEDED%==1 (
    echo Building manifesto-3d...
    cd manifesto-3d
    call npm install
    call npm run build
    cd ..
)

:: 4. Back to parent dir and build main project
echo Building voyager...
cd ..
call npm install
call npm run build-dev-local
npx serve dist

pause
