import google.generativeai as genai
import sys
import json
import os
from datetime import datetime
import logging
import re
from collections import Counter
# Configure logging
import logging
import os
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # Load API key from environment variable
if not GEMINI_API_KEY:
    logging.error("GEMINI_API_KEY environment variable not found")
MODEL_NAME = "gemini-2.0-flash"

# Communication style file
STYLE_PROFILE_FILE = "communication_style.json"

# Enhanced personality settings
BOT_PERSONALITY = """
You are responding as the owner of this WhatsApp account.So, don't say anything like you will tell to the Nithin or somthing like that, you are the digital Nithin. so reply like him. Your responses MUST be:
- EXTREMELY brief - maximum 2 sentences, around 40-60 words total. If the question is about something that eeds explantion, you can go up to 5 sentenses.
- Natural and conversational like a real person texting and make it more human-like.
- Appropriate to the relationship level with the contact
- In the same language as the incoming message
- Never mention you're an AI or analyzing anything, ANd give response ithout any emojis a
- Keep it casual and human-like and not to be overly formal or robotic. Be scarsctic and highly friendl make the intresting conversation and driving the conversation forward hile keeping it more cool and scarsctic, entertining and engaging.
- Just for your info no mention of this and specially if the person ask who made it say my name Nithin and mention made for when i am bored but now when i am busy it serves for him. Make this one in some scarscity. If more info is asked say if you are that much curious about him you can ask him in a call.
- If the contact is a close family member or friend, use a more casual tone, mostly be friendly and don't make formal replies.

"""

def setup_gemini():
    try:
        if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            raise ValueError("Please set your actual Gemini API key in the script")
        
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(MODEL_NAME)
        return model
    except Exception as e:
        logging.error(f"Failed to setup Gemini: {e}")
        return None

def analyze_communication_style(messages):
    """Analyze communication patterns from past messages"""
    if not messages:
        return {}
    
    # Filter only user's own messages
    user_messages = [msg['text'] for msg in messages if msg.get('fromMe', False)]
    
    if not user_messages:
        return {}
    
    style_analysis = {
        'avg_message_length': sum(len(msg) for msg in user_messages) / len(user_messages),
        'uses_emojis': bool(re.search(r'[😀-🙏]', ' '.join(user_messages))),
        'uses_abbreviations': bool(re.search(r'\b(u|ur|r|n|y|k|lol|brb|ttyl|omg|btw)\b', ' '.join(user_messages).lower())),
        'punctuation_style': analyze_punctuation(user_messages),
        'greeting_style': analyze_greetings(user_messages),
        'formality_level': analyze_formality(user_messages),
        'response_patterns': analyze_response_patterns(user_messages)
    }
    
    return style_analysis

def analyze_punctuation(messages):
    all_text = ' '.join(messages)
    
    patterns = {
        'uses_periods': '.' in all_text,
        'uses_exclamation': '!' in all_text,
        'uses_question_marks': '?' in all_text,
        'uses_multiple_punctuation': bool(re.search(r'[.!?]{2,}', all_text)),
        'uses_ellipsis': '...' in all_text or '…' in all_text
    }
    
    return patterns

def analyze_greetings(messages):
    greetings = []
    greeting_patterns = [
        r'\b(hi|hello|hey|hiya|sup|wassup|yo)\b',
        r'\b(good morning|good afternoon|good evening|good night)\b',
        r'\b(how are you|how r u|what\'s up|how\'s it going)\b'
    ]
    
    for msg in messages:
        for pattern in greeting_patterns:
            if re.search(pattern, msg.lower()):
                greetings.append(msg.lower())
                break
    
    return {
        'common_greetings': list(set(greetings))[:5],
        'greeting_frequency': len(greetings) / len(messages) if messages else 0
    }

def analyze_formality(messages):
    formal_indicators = ['please', 'thank you', 'thanks', 'appreciate', 'sincerely', 'regards']
    informal_indicators = ['gonna', 'wanna', 'gotta', 'yeah', 'yep', 'nah', 'lol', 'haha']
    
    all_text = ' '.join(messages).lower()
    
    formal_count = sum(1 for word in formal_indicators if word in all_text)
    informal_count = sum(1 for word in informal_indicators if word in all_text)
    
    if formal_count > informal_count:
        return 'formal'
    elif informal_count > formal_count:
        return 'informal'
    else:
        return 'neutral'

def analyze_response_patterns(messages):
    patterns = {
        'asks_questions': sum(1 for msg in messages if '?' in msg) / len(messages) if messages else 0,
        'gives_explanations': sum(1 for msg in messages if len(msg) > 50) / len(messages) if messages else 0,
        'uses_short_responses': sum(1 for msg in messages if len(msg) <= 10) / len(messages) if messages else 0
    }
    
    return patterns

def load_communication_style():
    try:
        if os.path.exists(STYLE_PROFILE_FILE):
            with open(STYLE_PROFILE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logging.error(f"Error loading communication style: {e}")
    
    return {}

def save_communication_style(style_data):
    try:
        with open(STYLE_PROFILE_FILE, 'w', encoding='utf-8') as f:
            json.dump(style_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logging.error(f"Error saving communication style: {e}")

def determine_relationship_level(contact_name, previous_messages):
    if not previous_messages:
        return 'acquaintance'
    
    message_count = len(previous_messages)
    avg_length = sum(len(msg.get('text', '')) for msg in previous_messages) / message_count
    
    # Analyze conversation patterns
    personal_indicators = ['love', 'miss', 'family', 'home', 'work', 'feeling', 'tired', 'busy']
    casual_indicators = ['lol', 'haha', 'dude', 'bro', 'hey', 'sup']
    
    all_text = ' '.join([msg.get('text', '') for msg in previous_messages]).lower()
    
    personal_score = sum(1 for word in personal_indicators if word in all_text)
    casual_score = sum(1 for word in casual_indicators if word in all_text)
    
    # Determine relationship level
    if message_count > 50 and (personal_score > 3 or 'mom' in contact_name.lower() or 'dad' in contact_name.lower()):
        return 'close_family'
    elif message_count > 20 and (personal_score > 2 or casual_score > 3):
        return 'close_friend'
    elif message_count > 10:
        return 'friend'
    else:
        return 'acquaintance'

def build_enhanced_context(contact_name, previous_messages):
    context = f"You are chatting with {contact_name}."
    
    if previous_messages and len(previous_messages) > 0:
        # Analyze communication style
        style_analysis = analyze_communication_style(previous_messages)
        relationship_level = determine_relationship_level(contact_name, previous_messages)
        
        # Load global communication style
        global_style = load_communication_style()
        
        # Update global style with new analysis
        if style_analysis:
            global_style.update(style_analysis)
            save_communication_style(global_style)
        
        context += f"\n\nRelationship level: {relationship_level}"
        
        # Add style guidance
        if style_analysis:
            context += "\n\nYour communication style analysis:"
            if style_analysis.get('formality_level'):
                context += f"\n- Formality: {style_analysis['formality_level']}"
            if style_analysis.get('uses_emojis'):
                context += f"\n- Emoji usage: {'Yes' if style_analysis['uses_emojis'] else 'No'}"
            if style_analysis.get('uses_abbreviations'):
                context += f"\n- Abbreviations: {'Yes' if style_analysis['uses_abbreviations'] else 'No'}"
            if style_analysis.get('avg_message_length'):
                context += f"\n- Average message length: {style_analysis['avg_message_length']:.0f} characters"
        
        context += "\n\nRecent conversation:\n"
        msg_limit = 8 if relationship_level in ['close_family', 'close_friend'] else 5
        recent_messages = previous_messages[-msg_limit:]
        
        for msg in recent_messages:
            sender = "You" if msg.get('fromMe', False) else contact_name
            message_text = msg.get('text', '')
            
            # Add message to context
            if len(message_text) > 150:
                message_text = message_text[:150] + "..."
            
            context += f"{sender}: {message_text}\n"
    else:
        context += " This is the start of your conversation."
    
    return context

def analyze_current_message(message):
    message_lower = message.lower()
    
    # Urgency analysis
    urgent_keywords = ['urgent', 'emergency', 'asap', 'immediately', 'help', 'problem', 'issue', 'quickly']
    urgency = 'high' if any(word in message_lower for word in urgent_keywords) else 'normal'
    
    # Sentiment analysis (basic)
    positive_words = ['good', 'great', 'awesome', 'happy', 'excited', 'love', 'thank']
    negative_words = ['bad', 'terrible', 'sad', 'angry', 'upset', 'disappointed', 'hate']
    
    positive_count = sum(1 for word in positive_words if word in message_lower)
    negative_count = sum(1 for word in negative_words if word in message_lower)
    
    if positive_count > negative_count:
        sentiment = 'positive'
    elif negative_count > positive_count:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'
    
    # Question type analysis
    question_type = 'none'
    if '?' in message:
        if any(word in message_lower for word in ['when', 'what time', 'schedule']):
            question_type = 'timing'
        elif any(word in message_lower for word in ['where', 'location']):
            question_type = 'location'
        elif any(word in message_lower for word in ['how', 'why']):
            question_type = 'explanation'
        elif any(word in message_lower for word in ['can you', 'could you', 'will you']):
            question_type = 'request'
        else:
            question_type = 'general'
    
    return {
        'urgency': urgency,
        'sentiment': sentiment,
        'question_type': question_type
    }

def get_contextual_fallback_response(message, contact_name, previous_messages):
    message_lower = message.lower()
    relationship = determine_relationship_level(contact_name, previous_messages or [])
    
    # Relationship-based responses - all very short
    if relationship == 'close_family':
        greeting_responses = [
            f"Hi {contact_name}! Busy with work right now, will call you later! ❤️",
            f"Hey! Can't talk now but will get back to you soon 😊"
        ]
        general_responses = [
            "Tied up right now but will respond soon!",
            "Give me a bit, will get back to you ❤️"
        ]
    elif relationship == 'close_friend':
        greeting_responses = [
            f"Hey {contact_name}! Busy rn but will hit you up soon! 😊",
            f"Sup! Can't chat now but will text back soon"
        ]
        general_responses = [
            "Busy right now but will get back to you!",
            "Give me a sec, will respond soon! 😊"
        ]
    else:
        greeting_responses = [
            f"Hi {contact_name}! Busy at the moment but will respond soon.",
            f"Hello! Can't talk right now but will get back to you."
        ]
        general_responses = [
            "Thanks for your message! I'll respond when I'm free.",
            "Busy right now but will get back to you soon."
        ]
    
    # Context-based responses - all short
    if any(word in message_lower for word in ['hello', 'hi', 'hey', 'good morning', 'good evening']):
        return greeting_responses[0]
    
    elif any(word in message_lower for word in ['how are you', 'how r u', 'what\'s up', 'wassup']):
        return "Doing well, thanks! Caught up with work right now. How about you?"
    
    elif any(word in message_lower for word in ['call', 'phone', 'ring']):
        if relationship == 'close_family':
            return "Can't take calls right now but will call back soon! ❤️"
        else:
            return "Can't take calls at the moment, will call back later!"
    
    elif any(word in message_lower for word in ['urgent', 'important', 'emergency']):
        return "Got your message! If urgent, please call. Otherwise will respond soon."
    
    elif '?' in message:
        return "Thanks for your question! Will get back with an answer soon."
    
    else:
        return general_responses[0]

def should_end_conversation(message, contact_name, previous_messages):
    message_lower = message.lower().strip()
    
    ending_phrases = [
        # Simple acknowledgments
        'ok', 'okay', 'k', 'kk', 'got it', 'alright', 'sure',
        # Goodbyes
        'bye', 'goodbye', 'see you', 'talk later', 'ttyl', 'catch you later',
        'good night', 'goodnight', 'gn', 'sleep well', 'sweet dreams',
        'good morning', 'gm', 'good afternoon', 'good evening',
        # Agreement/acknowledgment
        'yes', 'yeah', 'yep', 'yup', 'no problem', 'np', 'cool', 'nice',
        'thanks', 'thank you', 'ty', 'thx', 'appreciated',
        # Casual endings
        'hmm', 'hm', 'oh', 'ah', 'i see', 'noted', 'understood',
        # Single emoji or very short responses
        '👍', '👌', '😊', '😄', '🙂', '❤️', '♥️'
    ]
    
    if message_lower in ending_phrases:
        return True
    
    if len(message_lower) <= 3 and message_lower in ['k', 'ok', 'ty', 'gn', 'gm']:
        return True
    
    # Check if message is just emojis (common ending pattern)
    emoji_only = re.sub(r'[😀-🙏🎉-🎊❤️-💯👍-👎]', '', message_lower).strip()
    if len(emoji_only) == 0 and len(message) <= 5:
        return True
    
    # Check recent conversation context for natural ending patterns
    if previous_messages and len(previous_messages) > 0:
        recent_msg = previous_messages[-1] if previous_messages else None
        if recent_msg and recent_msg.get('fromMe', False):
            my_last_msg = recent_msg.get('text', '').lower()
            
            # If I said something that naturally ends conversation and they just acknowledged
            ending_contexts = [
                'talk later', 'catch up soon', 'will call you', 'get back to you',
                'respond when free', 'busy right now', 'will text back'
            ]
            
            if any(context in my_last_msg for context in ending_contexts):
                if message_lower in ['ok', 'okay', 'sure', 'alright', 'thanks', 'cool']:
                    return True
    
    return False

def clean_and_truncate_message(message, max_length=2000):
    """Clean and truncate message to prevent errors"""
    try:
        # Remove problematic characters
        cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', message)
        
        # Truncate if too long
        if len(cleaned) > max_length:
            cleaned = cleaned[:max_length] + "..."
        
        return cleaned
    except Exception as e:
        logging.error(f"Error cleaning message: {e}")
        return "Hi! Got your message but having trouble processing it. Will get back to you soon!"

def clean_response_text(text):
    import unicodedata
    
    # First normalize unicode
    text = unicodedata.normalize('NFKD', text)
    
    # Remove control characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    text = text.replace('"', '"').replace('"', '"')  # Smart quotes to regular
    text = text.replace(''', "'").replace(''', "'")  # Smart apostrophes to regular
    text = text.replace('…', '...')  # Ellipsis to three dots
    text = text.replace('–', '-').replace('—', '-')  # Em/en dashes to hyphen
    text = text.replace('\u00a0', ' ')  # Non-breaking space to regular space
    
    text = ''.join(char if ord(char) < 128 else '' for char in text)
    
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def generate_response_gemini(user_message, contact_name, previous_messages=None):
    """Generate contextual response with tone matching and better error handling"""
    try:
        # Clean input message first
        user_message = clean_and_truncate_message(user_message)
        contact_name = clean_and_truncate_message(contact_name, 100)
        
        if should_end_conversation(user_message, contact_name, previous_messages or []):
            return None  # Return None to indicate no response needed
        
        model = setup_gemini()
        if not model:
            print("Failed to setup Gemini, using fallback", file=sys.stderr)
            return get_contextual_fallback_response(user_message, contact_name, previous_messages)
        
        # Build enhanced context with length limits
        context = build_enhanced_context(contact_name, previous_messages or [])
        if len(context) > 2500:  # Reduced context length
            context = context[:2500] + "..."
        
        # Create a simpler, more reliable prompt
        prompt = f"""
        {BOT_PERSONALITY}
        
        {context}
        
        New message from {contact_name}: "{user_message}"
        
        STRICT REQUIREMENTS:
        - make this response without any emoji or special characters like " or other things use noraml ., ! , , , ? etc are okay
        - Reply in kind with the tone and style of the conversation
        - Sound like a real person texting, not an AI
        - Be natural, conversational, sarcastic and engaging
        - NO mention of AI, analysis, or being a bot
        - Use only basic ASCII characters (no smart quotes or special symbols)
        - Keep response under 40 words
        
        Respond now:
        """
        
        # Generate response with stricter settings
        try:
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=150,  # Reduced further
                    temperature=0.8,
                    top_p=0.9,
                    top_k=30
                )
            )
            
            if response and hasattr(response, 'text') and response.text:
                # Clean and validate response aggressively
                response_text = clean_response_text(response.text)
                
                # Ensure response is short enough
                words = response_text.split()
                if len(words) > 40:
                    response_text = ' '.join(words[:35])
                
                # Final validation - ASCII only
                if len(response_text) > 140:
                    response_text = response_text[:130]
                
                # Ensure we have a valid ASCII-only response
                if response_text and len(response_text.strip()) > 0:
                    # Final ASCII check
                    ascii_response = ''.join(char if ord(char) < 128 else '' for char in response_text)
                    if ascii_response.strip():
                        return ascii_response.strip()
                    else:
                        print("Response contained no ASCII characters", file=sys.stderr)
                        return "Got your message! Will respond soon."
                else:
                    print("Response was empty after cleaning", file=sys.stderr)
                    return "Got your message! Will respond soon."
            else:
                print("No valid response from Gemini", file=sys.stderr)
                return "Got your message! Will respond soon."
                
        except Exception as api_error:
            print(f"Gemini API error: {api_error}", file=sys.stderr)
            return "Got your message! Will respond soon."
            
    except Exception as e:
        print(f"Error generating response: {e}", file=sys.stderr)
        return "Got your message! Will respond soon."
def generate_response(user_message, contact_name, previous_messages=None):
    try:
        # Clean input message first
        user_message = clean_and_truncate_message(user_message)
        contact_name = clean_and_truncate_message(contact_name, 100)
        
        # Check if conversation should end (no reply needed)
        if should_end_conversation(user_message, contact_name, previous_messages or []):
            return None  # Return None to indicate no response needed
        
        # Build enhanced context with length limits
        context = build_enhanced_context(contact_name, previous_messages or [])
        if len(context) > 2500:  # Reduced context length
            context = context[:2500] + "..."
        
        # Setup OpenRouter API
        import requests

        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            logging.error("OPENROUTER_API_KEY environment variable not found")
           
        
        # Create the messages for OpenRouter
        system_message = f"""
        {BOT_PERSONALITY}
        
        {context}
        
        STRICT REQUIREMENTS:
        - make this response without any emoji or special characters like " or other things use normal ., ! , , , ? etc are okay
        - Reply in kind with the tone and style of the conversation
        - Sound like a real person texting, not an AI
        - Be natural, conversational, sarcastic and engaging
        - NO mention of AI, analysis, or being a bot
        - Use only basic ASCII characters (no smart quotes or special symbols)
        - Keep response under 40 words
        """
        
        user_content = f'New message from {contact_name}: "{user_message}"\n\nRespond now:'
        
        try:
            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://github.com/nithin434/woat",
                    "X-Title": "WOAT WhatsApp Bot",
                },
                data=json.dumps({
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {
                            "role": "system",
                            "content": system_message
                        },
                        {
                            "role": "user",
                            "content": user_content
                        }
                    ],
                    "max_tokens": 100,
                    "temperature": 0.8,
                    "top_p": 0.9
                })
            )
            
            print(f"OpenRouter response status: {response.status_code}", file=sys.stderr)
            
            if response.status_code == 200:
                response_data = response.json()
                print(f"OpenRouter response data: {response_data}", file=sys.stderr)
                
                if 'choices' in response_data and len(response_data['choices']) > 0:
                    response_text = response_data['choices'][0]['message']['content'].strip()
                    print(f"Raw response text: '{response_text}'", file=sys.stderr)
                    
                    # Clean and validate response aggressively
                    response_text = clean_response_text(response_text)
                    print(f"Cleaned response text: '{response_text}'", file=sys.stderr)
                    
                    # Ensure response is short enough
                    words = response_text.split()
                    if len(words) > 40:
                        response_text = ' '.join(words[:35])
                    
                    # Final validation - ASCII only
                    if len(response_text) > 140:
                        response_text = response_text[:130]
                    
                    if response_text and len(response_text.strip()) > 0:
                        # Final ASCII check
                        ascii_response = ''.join(char if ord(char) < 128 else '' for char in response_text)
                        if ascii_response.strip():
                            print(f"Final ASCII response: '{ascii_response.strip()}'", file=sys.stderr)
                            return ascii_response.strip()
                        else:
                            print("Response contained no ASCII characters", file=sys.stderr)
                            return get_contextual_fallback_response(user_message, contact_name, previous_messages)
                    else:
                        print("Response was empty after cleaning", file=sys.stderr)
                        return get_contextual_fallback_response(user_message, contact_name, previous_messages)
                else:
                    print("No valid response from OpenRouter", file=sys.stderr)
                    return get_contextual_fallback_response(user_message, contact_name, previous_messages)
            else:
                print(f"OpenRouter API error: {response.status_code} - {response.text}", file=sys.stderr)
                return get_contextual_fallback_response(user_message, contact_name, previous_messages)
                
        except Exception as api_error:
            print(f"OpenRouter API error: {api_error}", file=sys.stderr)
            print(f"Error type: {type(api_error).__name__}", file=sys.stderr)
            return get_contextual_fallback_response(user_message, contact_name, previous_messages)
            
    except Exception as e:
        print(f"Error generating response: {e}", file=sys.stderr)
        print(f"Error type: {type(e).__name__}", file=sys.stderr)
        return get_contextual_fallback_response(user_message, contact_name, previous_messages)

def main():
    try:
        if len(sys.argv) < 3:
            print("Error: Insufficient arguments")
            print("Usage: python gemini_bot.py <message> <contact_name> [previous_messages_json]")
            sys.exit(1)
        
        user_message = sys.argv[1]
        contact_name = sys.argv[2]
        previous_messages = []
        if len(sys.argv) > 3:
            try:
                previous_messages = json.loads(sys.argv[3])
            except json.JSONDecodeError:
                logging.error("Invalid JSON for previous messages")
                previous_messages = []
        
        # Generate and print response
        response = generate_response(user_message, contact_name, previous_messages)
        
        if response is None:
            print("END_CONVERSATION")  # Special marker for no response
        else:
            print(response)
        
    except KeyboardInterrupt:
        logging.info("Script interrupted by user")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        print("Sorry, I'm having trouble responding right now. Will get back to you soon!")
        sys.exit(1)

if __name__ == "__main__":
    main()