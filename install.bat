@echo off
cls
echo.
echo            -- Nithin --
echo.
echo 🤖 WOAT - WhatsApp Automation Tool - Windows Installer
echo 🔗 GitHub: https://github.com/nithin434/woat.git
echo ═══════════════════════════════════════════════════
echo.

REM Check if Node.js is installed
echo 🔍 Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo 📥 Please install Node.js first:
    echo 1. Go to https://nodejs.org/
    echo 2. Download LTS version
    echo 3. Install with default settings
    echo 4. Restart your computer
    echo 5. Run this script again
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js detected: 
node --version

REM Check if Python is installed
echo 🔍 Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Python is not installed!
        echo.
        echo 📥 Please install Python first:
        echo 1. Go to https://python.org/downloads/
        echo 2. Download latest version
        echo 3. ✅ IMPORTANT: Check "Add Python to PATH" during installation
        echo 4. Install with default settings
        echo 5. Restart your computer
        echo 6. Run this script again
        echo.
        pause
        exit /b 1
    ) else (
        echo ✅ Python detected (via py command):
        py --version
        set PYTHON_CMD=py
    )
) else (
    echo ✅ Python detected:
    python --version
    set PYTHON_CMD=python
)

echo.
echo 🏗️ Setting up Python virtual environment...

REM Remove existing venv if it exists
if exist "woat_env" (
    echo 🗑️ Removing existing virtual environment...
    rmdir /s /q woat_env
)

REM Create new virtual environment
echo 📦 Creating new virtual environment...
%PYTHON_CMD% -m venv woat_env
if %errorlevel% neq 0 (
    echo ❌ Failed to create virtual environment!
    echo Trying alternative method...
    %PYTHON_CMD% -m pip install --user virtualenv
    %PYTHON_CMD% -m virtualenv woat_env
    if %errorlevel% neq 0 (
        echo ❌ Virtual environment creation failed completely!
        echo Continuing without virtual environment...
        set NO_VENV=1
    )
)

REM Activate virtual environment
if not defined NO_VENV (
    echo ⚡ Activating virtual environment...
    call woat_env\Scripts\activate.bat
    if %errorlevel% neq 0 (
        echo ⚠️ Failed to activate virtual environment, continuing without it...
        set NO_VENV=1
    ) else (
        echo ✅ Virtual environment activated successfully!
        set PYTHON_CMD=python
    )
)

echo.
echo 📦 Installing Node.js dependencies...

REM Install Node.js packages
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install Node.js packages
    echo 🔧 Trying to fix npm issues...
    call npm cache clean --force
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo ❌ Still failed! Trying individual packages...
        call npm install whatsapp-web.js qrcode-terminal form-data archiver --legacy-peer-deps
        if %errorlevel% neq 0 (
            echo ❌ Node.js package installation failed completely!
            echo.
            echo 🔧 TROUBLESHOOTING:
            echo 1. Check your internet connection
            echo 2. Try running as Administrator
            echo 3. Update npm: npm install -g npm@latest
            echo.
            pause
            exit /b 1
        )
    )
)

echo ✅ Node.js dependencies installed successfully!

echo.
echo 🔧 Upgrading Python tools...
%PYTHON_CMD% -m pip install --upgrade pip setuptools wheel
if %errorlevel% neq 0 (
    echo ⚠️ Failed to upgrade Python tools, continuing anyway...
)

echo.
echo 🐍 Installing Python dependencies...
echo This may take a few minutes, please wait...

REM Try standard installation first
echo 📥 Attempting standard installation...
%PYTHON_CMD% -m pip install google-generativeai
if %errorlevel% equ 0 (
    echo ✅ Python dependencies installed successfully!
    goto installation_success
)

echo ❌ Standard installation failed, trying alternative methods...

REM Method 2: No cache
echo 📥 Trying without cache...
%PYTHON_CMD% -m pip install google-generativeai --no-cache-dir
if %errorlevel% equ 0 (
    echo ✅ Python dependencies installed successfully (no cache)!
    goto installation_success
)

REM Method 3: Pre-built wheels only (no compilation)
echo 📥 Trying pre-built wheels only (no compilation)...
%PYTHON_CMD% -m pip install google-generativeai --only-binary=all --no-cache-dir
if %errorlevel% equ 0 (
    echo ✅ Python dependencies installed successfully (pre-built wheels)!
    goto installation_success
)

REM Method 4: Specific stable version
echo 📥 Trying specific stable version...
%PYTHON_CMD% -m pip install google-generativeai==0.3.2 --no-cache-dir
if %errorlevel% equ 0 (
    echo ✅ Python dependencies installed successfully (stable version)!
    goto installation_success
)

REM Method 5: User installation
echo 📥 Trying user installation...
%PYTHON_CMD% -m pip install --user google-generativeai --no-cache-dir
if %errorlevel% equ 0 (
    echo ✅ Python dependencies installed successfully (user install)!
    goto installation_success
)

REM Method 6: Force reinstall without dependencies
echo 📥 Trying force reinstall...
%PYTHON_CMD% -m pip install google-generativeai --force-reinstall --no-deps --no-cache-dir
if %errorlevel% equ 0 (
    echo ✅ Python dependencies installed successfully (force reinstall)!
    goto installation_success
)

REM All methods failed
echo ❌ All Python installation methods failed!
echo.
echo 🔧 TROUBLESHOOTING OPTIONS:
echo 1. Install Microsoft Visual C++ Build Tools from:
echo    https://visualstudio.microsoft.com/visual-cpp-build-tools/
echo 2. Or install Visual Studio Community (free)
echo 3. Try manual installation: pip install google-generativeai
echo 4. Use the bot in simple mode (without AI features)
echo.
echo ⚠️ AI features will be disabled - bot will use simple replies only
set PYTHON_INSTALL_FAILED=1

:installation_success

echo.
echo ✅ Installation completed!
echo.

if defined PYTHON_INSTALL_FAILED (
    echo ⚠️ INSTALLATION NOTES:
    echo - Python AI features disabled due to installation issues
    echo - Bot will work with simple auto-replies
    echo - To enable AI later, manually install: pip install google-generativeai
    echo.
)

if not defined NO_VENV (
    echo 🌐 Virtual Environment: ✅ Created and configured
    echo 📁 Location: woat_env\
    echo 💡 To activate manually: woat_env\Scripts\activate
    echo.
)

echo 📝 NEXT STEPS:
echo 1. Configure your settings in config.json
echo 2. Add your Gemini API key and contacts to monitor
echo 3. Run the bot using start.bat or node smart_whatsapp_bot.js
echo.
echo 💝 Created with ❤️ by Nithin
echo 🔗 GitHub: https://github.com/nithin434/woat.git
echo 📧 Contact: nithinjambula89@gmail.com
echo.

REM Deactivate virtual environment if it was activated
if not defined NO_VENV (
    call woat_env\Scripts\deactivate.bat 2>nul
)

echo ✨ Installation complete! Ready to run your WhatsApp bot!
echo.
pause