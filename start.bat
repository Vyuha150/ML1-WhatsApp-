@echo off
cls
echo.
echo WOAT - WhatsApp Automation Tool - Windows Installer
echo GitHub: https://github.com/nithin434/woat.git
echo Created by Nithin
echo ===============================================
echo.

REM Check if Node.js is installed
echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo 1. Go to https://nodejs.org/
    echo 2. Download LTS version
    echo 3. Install with default settings
    echo 4. Restart your computer
    echo 5. Run this script again
    echo.
    pause
    exit /b 1
)

echo SUCCESS: Node.js detected
node --version

REM Check if Python is installed
@REM echo Checking Python installation...
set PYTHON_CMD=
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo SUCCESS: Python detected
    python --version
    set PYTHON_CMD=python
) else (
    py --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo SUCCESS: Python detected via py command
        py --version
        set PYTHON_CMD=py
    ) else (
        echo ERROR: Python is not installed!
        echo.
        echo Please install Python first:
        echo 1. Go to https://python.org/downloads/
        echo 2. Download latest version
        echo 3. IMPORTANT: Check "Add Python to PATH" during installation
        echo 4. Install with default settings
        echo 5. Restart your computer
        echo 6. Run this script again
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Setting up Python virtual environment...

REM Remove existing venv if it exists
@REM if exist "woat_env" (
@REM     echo Removing existing virtual environment...
@REM     rmdir /s /q woat_env
@REM )

REM Create new virtual environment
echo Creating new virtual environment...
%PYTHON_CMD% -m venv woat_env
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment!
    echo Trying alternative method...
    %PYTHON_CMD% -m pip install --user virtualenv
    %PYTHON_CMD% -m virtualenv woat_env
    if %errorlevel% neq 0 (
        echo ERROR: Virtual environment creation failed completely!
        echo Continuing without virtual environment...
        set NO_VENV=1
    )
)

REM Activate virtual environment
if not defined NO_VENV (
    echo Activating virtual environment...
    call woat_env\Scripts\activate.bat
    if %errorlevel% neq 0 (
        echo WARNING: Failed to activate virtual environment, continuing without it...
        set NO_VENV=1
    ) else (
        echo SUCCESS: Virtual environment activated
        set PYTHON_CMD=python
    )
)

echo.
echo Installing Node.js dependencies...

REM Check if package.json exists, create if not
if not exist "package.json" (
    @REM echo Creating package.json...
    echo {> package.json
    echo   "name": "woat-whatsapp-bot",>> package.json
    echo   "version": "1.0.0",>> package.json
    echo   "description": "WOAT - WhatsApp Automation Tool",>> package.json
    echo   "main": "smart_whatsapp_bot.js",>> package.json
    echo   "scripts": {>> package.json
    echo     "start": "node smart_whatsapp_bot.js">> package.json
    echo   },>> package.json
    echo   "dependencies": {>> package.json
    echo     "whatsapp-web.js": "^1.21.0",>> package.json
    echo     "qrcode-terminal": "^0.12.0",>> package.json
    echo     "form-data": "^4.0.0",>> package.json
    echo     "archiver": "^5.3.2">> package.json
    echo   },>> package.json
    echo   "keywords": ["whatsapp", "bot", "automation", "woat"],>> package.json
    echo   "author": "Nithin",>> package.json
    echo   "license": "MIT">> package.json
    echo }>> package.json
)

REM Install Node.js packages
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Node.js packages
    echo Trying to fix npm issues...
    call npm cache clean --force
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo ERROR: Still failed! Trying individual packages...
        call npm install whatsapp-web.js qrcode-terminal form-data archiver --legacy-peer-deps
        if %errorlevel% neq 0 (
            echo ERROR: Node.js package installation failed completely!
            echo.
            echo TROUBLESHOOTING:
            echo 1. Check your internet connection
            echo 2. Try running as Administrator
            echo 3. Update npm: npm install -g npm@latest
            echo.
            pause
            exit /b 1
        )
    )
)

echo SUCCESS: Node.js dependencies installed

echo.
@REM echo Upgrading Python tools...
%PYTHON_CMD% -m pip install --upgrade pip setuptools wheel
if %errorlevel% neq 0 (
    echo WARNING: Failed to upgrade Python tools, continuing anyway...
)

echo.
echo Installing Python dependencies...


REM Try multiple methods to install google-generativeai
@REM echo Attempting standard installation...
%PYTHON_CMD% -m pip install google-generativeai --no-cache-dir
if %errorlevel% neq 0 (
    echo Method 1 failed, trying pre-built wheels only...
    %PYTHON_CMD% -m pip install google-generativeai --only-binary=all --no-cache-dir
    if %errorlevel% neq 0 (
        echo Method 2 failed, trying specific version...
        %PYTHON_CMD% -m pip install google-generativeai==0.3.2 --no-cache-dir
        if %errorlevel% neq 0 (
            echo Method 3 failed, trying force reinstall...
            %PYTHON_CMD% -m pip install google-generativeai --force-reinstall --no-deps
            if %errorlevel% neq 0 (
                echo ERROR: All Python installation methods failed!
                echo.
                echo TROUBLESHOOTING OPTIONS:
                echo 1. Install Microsoft Visual C++ Build Tools
                echo 2. Try: pip install google-generativeai --upgrade
                echo 3. Use simple mode without AI features
                echo.
                echo WARNING: Continuing without AI features
                set PYTHON_INSTALL_FAILED=1
            ) else (
                echo SUCCESS: Python dependencies installed (method 4)
            )
        ) else (
            echo SUCCESS: Python dependencies installed (method 3)
        )
    ) else (
        echo SUCCESS: Python dependencies installed (method 2)
    )
) else (
    echo SUCCESS: Python dependencies installed (method 1)
)

echo.
echo Installation completed!
echo.

@REM if defined PYTHON_INSTALL_FAILED (
@REM     echo WARNING: Python AI features disabled due to installation issues
@REM     echo The bot will work with simple auto-replies only
@REM     echo To enable AI later, manually run: woat_env\Scripts\activate and pip install google-generativeai
@REM     echo.
@REM )

@REM if not defined NO_VENV (
@REM     echo Virtual Environment: Created and configured
@REM     echo Location: woat_env\
@REM     echo.
@REM )

echo NEXT STEPS:
echo 1. Configure your settings in config.json
echo 2. Add your Gemini API key and contacts to monitor
echo 3. Run the bot using start.bat or node smart_whatsapp_bot.js
echo.
echo Created with love by Nithin
echo GitHub: https://github.com/nithin434/woat.git
echo Contact: nithinjambula89@gmail.com
echo.

REM Deactivate virtual environment
if not defined NO_VENV (
    call woat_env\Scripts\deactivate.bat 2>nul
)

echo Installation complete! You can now configure and run your WhatsApp bot with >> node smart_whatsapp_bot.js .
echo.
pause