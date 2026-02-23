# WOAT - WhatsApp & Instagram Automation Framework

![WhatsApp Bot Demo](https://img.shields.io/badge/WhatsApp-WOAT-green)
![Node.js](https://img.shields.io/badge/Node.js-v14+-blue)
![Python](https://img.shields.io/badge/Python-3.7+-yellow)
![AI Powered](https://img.shields.io/badge/AI-Gemini-purple)

A comprehensive framework for automating WhatsApp and Instagram messaging using Google Gemini AI for intelligent response generation. This framework analyzes communication patterns, adapts to conversation contexts, and generates responses that match your communication style.

**WOAT** The most average bot with above-average sarcasm.**(will be loading the full version soon)**

## Overview

WOAT (WhatsApp & Instagram Automation Tool) provides automated messaging capabilities powered by Gemini Flash 1.5 API. The system intelligently analyzes conversation history, relationship dynamics, and communication patterns to generate contextually appropriate responses that mirror your personal messaging style.

## Core Components

### WhatsApp Bot (`smart_whatsapp_bot.js`)
- **Runtime**: Node.js
- **Features**: 
  - Message monitoring with contact filtering
  - Intelligent auto-replies with relationship awareness
  - Communication style analysis and adaptation
  - Chat history persistence
  - Contact profile building
  - Analytics tracking

### Instagram Bot (`insta_bot.py`)
- **Runtime**: Python
- **Interface**: Web-based configuration panel
- **Features**: 
  - Real-time parameter adjustment
  - Message handling with personality customization
  - Web interface for easy configuration

### AI Integration (`gemini_bot.py`)
- **Model**: Gemini Flash 1.5 / OpenRouter GPT-4o-mini
- **Capabilities**: 
  - Communication style analysis
  - Tone adaptation based on relationships
  - Contextual response generation
  - Conversation flow management

## Detailed Configuration

### 1. Contact Management (`smart_whatsapp_bot.js` - Lines 11-12)

Control which contacts receive automated responses:

```javascript
const MONITOR_CONTACTS = ["ALL"]; // Options:
// ["ALL"] - Respond to everyone
// ["Contact Name", "+91XXXXXXXXXX", "Another Contact"] - Specific contacts
// [] - Respond to no one

const DO_NOT_REPLY_CONTACTS = [" "]; // Blacklist contacts:
// ["Spam Contact", "+91XXXXXXXXXX", "Group Admin"] - Never reply to these
// [" "] - Empty blacklist (reply to all monitored contacts)
```

**Configuration Examples:**
- **Respond to everyone except spam**: `MONITOR_CONTACTS = ["ALL"]`, `DO_NOT_REPLY_CONTACTS = ["Spam User", "Marketing Bot"]`
- **Family and friends only**: `MONITOR_CONTACTS = ["Mom", "Dad", "Best Friend", "+91XXXXXXXXXX"]`
- **Specific numbers**: `MONITOR_CONTACTS = ["+919876543210", "+918765432109"]`

### 2. AI Response Settings (`smart_whatsapp_bot.js` - Lines 13-15)

Configure response behavior and fallback messages:

```javascript
const USE_AI_RESPONSES = true; // true = AI responses, false = simple auto-reply
const SIMPLE_REPLY = "Custom fallback message when AI is disabled";
const AI_INTRODUCTION = "Your custom AI introduction message";
```

**Customization Options:**
- **AI_INTRODUCTION**: First message sent to new contacts (sent only once)
- **SIMPLE_REPLY**: Fallback when AI fails or is disabled
- **USE_AI_RESPONSES**: Toggle between AI and simple responses

### 3. Bot Personality (`gemini_bot.py` - Lines 27-38)

Fine-tune the AI's communication style and personality:

```python
BOT_PERSONALITY = """
You are responding as the owner of this WhatsApp account. Your responses MUST be:
- EXTREMELY brief - maximum 2 sentences, around 40-60 words total
- Natural and conversational like a real person texting
- Appropriate to the relationship level with the contact
- In the same language as the incoming message
- Never mention you're an AI or analyzing anything
- Keep it casual and human-like, not overly formal or robotic
- Be sarcastic and highly friendly, make interesting conversation
- Drive conversation forward while keeping it cool and engaging
"""
```

**Personality Customization Options:**
- **Response Length**: Adjust word limits and sentence count
- **Tone**: Sarcastic, serious, friendly, professional, instructive
- **Formality Level**: Casual, semi-formal, formal
- **Language Style**: Modern slang, traditional, professional
- **Relationship Awareness**: Family-friendly, friend-casual, professional-formal
**Try out different sytles**
**Example Personality Variations:**

```python
# Professional Personality
BOT_PERSONALITY = """
Professional and courteous responses. Keep formal tone, 
use proper grammar, avoid slang. Be helpful and informative.
"""

# Casual Friend Personality  
BOT_PERSONALITY = """
Casual and friendly like texting a close friend. Use modern slang,
be relaxed and fun. Keep responses short and engaging.
"""

# Sarcastic Personality (Default)
BOT_PERSONALITY = """
Witty and sarcastic responses with friendly undertone. 
Be entertaining while helpful. Use humor appropriately.
"""
```

## Advanced Configuration

### 4. API Configuration

#### Gemini API Setup (`gemini_bot.py`)
```python
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # Set in environment variables
MODEL_NAME = "gemini-2.0-flash"  # Model selection
```

#### OpenRouter API Setup (Alternative)
```python
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")  # Alternative AI provider
```

### 5. Response Behavior Customization

#### Relationship-Based Responses (`gemini_bot.py`)
The system automatically detects relationship levels and adjusts responses:

- **Family**: Warm, caring, emoji usage, faster responses
- **Close Friends**: Casual, slang, friendly tone
- **Friends**: Balanced formality, conversational
- **Acquaintances**: Polite, professional, measured responses

#### Communication Style Analysis
The bot learns from your message history:
- **Message Length**: Adapts to your typical response length
- **Emoji Usage**: Matches your emoji patterns
- **Formality Level**: Learns formal vs casual preferences  
- **Response Speed**: Adjusts based on relationship urgency

### 6. Session Management

#### WhatsApp Session Persistence
- Sessions are automatically saved in `./whatsapp_session/`
- QR code authentication required on first run
- Subsequent runs use saved session data

#### Data Storage Files
- `chat_history.json`: Conversation history for context
- `contact_profiles.json`: Relationship and style analysis
- `ai_introduced.json`: Tracks introduction message status
- `bot_analytics.json`: Usage statistics and patterns
- `communication_style.json`: Global style preferences

## Installation & Setup

### Prerequisites
```bash
# Node.js dependencies
npm install whatsapp-web.js qrcode-terminal archiver form-data

# Python dependencies  
pip install google-generativeai python-dotenv requests
```

### Environment Variables
Create a `.env` file:
```
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### API Key Setup
1. **Gemini API**: Get free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **OpenRouter API**: Alternative from [OpenRouter](https://openrouter.ai/) for more model options

## Usage

### WhatsApp Automation
```bash
node smart_whatsapp_bot.js
```

**First Run Process:**
1. QR code will appear in terminal
2. Scan with WhatsApp mobile app
3. Bot connects and starts monitoring
4. Wait 1 minute for chat loading
5. Begin receiving and responding to messages

### Instagram Automation  
```bash
python insta_bot.py
```
Access the web interface at `http://localhost:5000` for real-time configuration.

## Customization Examples

### Example 1: Family-Only Bot
```javascript
// smart_whatsapp_bot.js
const MONITOR_CONTACTS = ["Mom", "Dad", "Sister", "Brother"];
const AI_INTRODUCTION = "Hey! You've reached my auto-assistant. Family gets priority! ❤️";
```

### Example 2: Professional Assistant
```javascript
// smart_whatsapp_bot.js  
const MONITOR_CONTACTS = ["ALL"];
const DO_NOT_REPLY_CONTACTS = ["Personal Friends", "Family Group"];
const AI_INTRODUCTION = "Thank you for your message. I'm currently unavailable but will respond promptly.";
```

```python
# gemini_bot.py - Professional personality
BOT_PERSONALITY = """
Professional business assistant. Formal tone, courteous responses.
Focus on being helpful and informative. Avoid casual language.
"""
```

### Example 3: Close Friends Bot
```python
# gemini_bot.py - Casual personality
BOT_PERSONALITY = """
Respond like a close friend. Use casual language, modern slang,
be funny and engaging. Keep it real and entertaining.
"""
```

## Analytics & Monitoring

The framework tracks:
- **Message Statistics**: Total messages, responses, contact interactions
- **Relationship Analysis**: Contact relationship levels and communication patterns
- **Response Performance**: Success rates, fallback usage, error tracking
- **Daily Analytics**: Unique contacts, message volume, response times

## Development & Extension

### Adding New Platforms
The framework is designed for easy extension to additional messaging platforms:

1. Create new bot file (e.g., `telegram_bot.py`)
2. Implement message monitoring and sending
3. Integrate with existing AI response system
4. Add platform-specific configuration options

### Custom Response Filters
Implement custom logic for:
- **Time-based responses**: Different replies based on time of day
- **Location awareness**: Responses based on your location status
- **Mood adaptation**: Adjust tone based on your recent activity
- **Context filtering**: Handle specific keywords or topics differently

### AI Model Integration
Support for multiple AI providers:
- Google Gemini (primary)
- OpenRouter (GPT-4, Claude, etc.)
- Local LLM integration
- Custom model endpoints

## Troubleshooting

### Common Issues
1. **QR Code Authentication**: Ensure WhatsApp Web is logged out on other devices
2. **API Errors**: Verify API keys and internet connection
3. **Group Messages**: Bot automatically ignores group messages for privacy
4. **Rate Limiting**: Built-in delays prevent WhatsApp rate limits

### Debug Mode
Enable detailed logging by modifying console.log statements or setting environment variables.

## Security & Privacy

- **Data Storage**: All data stored locally
- **API Security**: API keys stored in environment variables
- **Group Privacy**: Automatic group message filtering
- **Session Security**: WhatsApp session data encrypted

## Contributing

Contributions welcome for:
- Additional messaging platform support
- Enhanced AI response capabilities  
- Better communication style analysis
- Improved user interface options
- Performance optimizations

## License

MIT License - Feel free to modify and distribute.

## Current Status

Framework is actively developed. Future releases will include:
- Enhanced web interface for all configurations
- More sophisticated relationship analysis
- Additional AI model integrations
- Mobile app companion
- Cloud deployment options

---

**Note**: This framework is designed for personal automation use. Ensure compliance with platform terms of service and respect user privacy when deploying.
