from flask import Flask, request, jsonify, abort, send_file
import os
import tempfile
import zipfile
import shutil
from datetime import datetime
import logging
import hashlib
import json

app = Flask(__name__)

# Configure logging for debug output
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Local storage configuration
SESSIONS_DIR = './stored_sessions'  # Local directory to store sessions
ALLOWED_USER_AGENTS = ['WOAT-Bot/1.0']
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB limit
METADATA_FILE = 'session_metadata.json'

# Create sessions directory if it doesn't exist
os.makedirs(SESSIONS_DIR, exist_ok=True)
print(f"📁 Sessions will be stored in: {os.path.abspath(SESSIONS_DIR)}")

def validate_request(request):
    """Validate incoming request"""
    user_agent = request.headers.get('User-Agent', '')
    print(f"🔍 Request User-Agent: {user_agent}")
    
    if user_agent not in ALLOWED_USER_AGENTS:
        print(f"❌ Invalid User-Agent: {user_agent}")
        return False, "Invalid user agent"
    
    content_length = request.content_length
    if content_length and content_length > MAX_FILE_SIZE:
        print(f"❌ File too large: {content_length} bytes")
        return False, "File too large"
    
    return True, "Valid"

def generate_session_id(user_id):
    """Generate unique session ID for user"""
    hash_object = hashlib.md5(user_id.encode())
    session_id = f"session_{hash_object.hexdigest()[:12]}"
    print(f"🔑 Generated session ID: {session_id} for user: {user_id}")
    return session_id

def get_user_session_dir(user_id):
    """Get user-specific session directory"""
    session_id = generate_session_id(user_id)
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    print(f"📂 Session directory: {session_dir}")
    return session_dir

def load_metadata():
    """Load session metadata"""
    metadata_path = os.path.join(SESSIONS_DIR, METADATA_FILE)
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                print(f"📋 Loaded metadata for {len(metadata)} sessions")
                return metadata
        except Exception as e:
            logger.error(f"Error loading metadata: {e}")
    print("📋 No existing metadata found, starting fresh")
    return {}

def save_metadata(metadata):
    """Save session metadata"""
    metadata_path = os.path.join(SESSIONS_DIR, METADATA_FILE)
    try:
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"💾 Saved metadata for {len(metadata)} sessions")
    except Exception as e:
        logger.error(f"Error saving metadata: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    print("❤️ Health check requested")
    return jsonify({
        'status': 'healthy',
        'service': 'WOAT Session Server',
        'storage': 'Local File System',
        'sessions_dir': SESSIONS_DIR,
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/check-session/<user_id>', methods=['GET'])
def check_session(user_id):
    """Check if session exists for user"""
    print(f"🔍 Checking session for user: {user_id}")
    
    try:
        # Simple validation - just check user agent
        user_agent = request.headers.get('User-Agent', '')
        if user_agent not in ALLOWED_USER_AGENTS:
            print(f"❌ Invalid User-Agent for check: {user_agent}")
            abort(403)
        
        session_id = generate_session_id(user_id)
        user_session_dir = get_user_session_dir(user_id)
        session_zip_path = os.path.join(user_session_dir, 'session.zip')
        
        exists = os.path.exists(session_zip_path)
        print(f"📁 Session exists: {exists} at {session_zip_path}")
        
        if exists:
            stat_info = os.stat(session_zip_path)
            print(f"📊 Session file size: {stat_info.st_size} bytes")
            
            return jsonify({
                'exists': True,
                'session_id': session_id,
                'size': stat_info.st_size,
                'modified': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        else:
            return jsonify({
                'exists': False,
                'session_id': session_id,
                'timestamp': datetime.utcnow().isoformat()
            }), 404
            
    except Exception as e:
        logger.error(f"Error checking session: {e}")
        abort(500)

@app.route('/upload-session', methods=['POST'])
def upload_session():
    """Upload session file"""
    print("📤 Session upload request received")
    print(f"📊 Request headers: {dict(request.headers)}")
    
    try:
        # Simple validation
        user_agent = request.headers.get('User-Agent', '')
        if user_agent not in ALLOWED_USER_AGENTS:
            print(f"❌ Invalid User-Agent for upload: {user_agent}")
            abort(403)
        
        # Log content info
        content_length = request.content_length
        print(f"📏 Content length: {content_length} bytes")
        
        # Get form data
        user_id = request.form.get('userId')
        user_agent_form = request.form.get('userAgent', '')
        timestamp = request.form.get('timestamp', datetime.utcnow().isoformat())
        
        print(f"👤 User ID: {user_id}")
        print(f"🤖 User Agent (form): {user_agent_form}")
        print(f"⏰ Timestamp: {timestamp}")
        print(f"📋 Form keys: {list(request.form.keys())}")
        print(f"📎 Files keys: {list(request.files.keys())}")
        
        if not user_id:
            print("❌ Missing user ID")
            abort(400)
        
        # Get uploaded file
        if 'session' not in request.files:
            print("❌ No session file in request")
            print(f"📎 Available files: {list(request.files.keys())}")
            abort(400)
        
        file = request.files['session']
        if file.filename == '':
            print("❌ Empty filename")
            abort(400)
        
        print(f"📁 Received file: {file.filename}")
        print(f"📄 File content type: {file.content_type}")
        
        # Generate session paths
        session_id = generate_session_id(user_id)
        user_session_dir = get_user_session_dir(user_id)
        session_zip_path = os.path.join(user_session_dir, 'session.zip')
        
        # Check if session already exists
        if os.path.exists(session_zip_path):
            print(f"ℹ️ Session already exists for user: {user_id}")
            return jsonify({
                'message': 'Session already exists',
                'session_id': session_id,
                'status': 'skipped'
            }), 200
        
        # Create user session directory
        print(f"📂 Creating directory: {user_session_dir}")
        os.makedirs(user_session_dir, exist_ok=True)
        
        # Save file directly to final location
        print(f"💾 Saving session file to: {session_zip_path}")
        
        # Read file in chunks to handle large files
        with open(session_zip_path, 'wb') as f:
            chunk_size = 1024 * 1024  # 1MB chunks
            total_written = 0
            
            while True:
                chunk = file.stream.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                total_written += len(chunk)
                if total_written % (5 * 1024 * 1024) == 0:  # Log every 5MB
                    print(f"📊 Written: {total_written / 1024 / 1024:.1f} MB")
        
        # Get file size
        file_size = os.path.getsize(session_zip_path)
        print(f"📊 Final file size: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)")
        
        # Basic validation - check if it's a valid zip
        try:
            with zipfile.ZipFile(session_zip_path, 'r') as test_zip:
                file_count = len(test_zip.namelist())
                print(f"✅ Valid ZIP file with {file_count} files")
        except zipfile.BadZipFile:
            print("❌ Invalid ZIP file")
            os.unlink(session_zip_path)
            abort(400)
        
        # Update metadata
        metadata = load_metadata()
        metadata[session_id] = {
            'user_id': user_id,
            'user_agent': user_agent_form,
            'upload_timestamp': timestamp,
            'server_timestamp': datetime.utcnow().isoformat(),
            'file_type': 'whatsapp_session',
            'file_path': session_zip_path,
            'size': file_size
        }
        save_metadata(metadata)
        
        print(f"✅ Session uploaded successfully for user: {user_id}")
        
        return jsonify({
            'message': 'Session uploaded successfully',
            'session_id': session_id,
            'status': 'uploaded',
            'size': file_size,
            'timestamp': datetime.utcnow().isoformat()
        }), 201
        
    except Exception as e:
        logger.error(f"Error uploading session: {e}")
        print(f"❌ Upload error: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        abort(500)

@app.route('/download-session/<user_id>', methods=['GET'])
def download_session(user_id):
    """Download session file"""
    print(f"📥 Download request for user: {user_id}")
    
    try:
        # Check if user_id is already a session ID (starts with 'session_')
        if user_id.startswith('session_'):
            session_id = user_id
            session_dir = os.path.join(SESSIONS_DIR, session_id)
        else:
            session_id = generate_session_id(user_id)
            session_dir = get_user_session_dir(user_id)
        
        session_zip_path = os.path.join(session_dir, 'session.zip')
        
        print(f"📂 Looking for session at: {session_zip_path}")
        
        if not os.path.exists(session_zip_path):
            print(f"❌ Session file not found: {session_zip_path}")
            
            # List available sessions for debugging
            if os.path.exists(SESSIONS_DIR):
                available_sessions = [d for d in os.listdir(SESSIONS_DIR) if os.path.isdir(os.path.join(SESSIONS_DIR, d))]
                print(f"📋 Available sessions: {available_sessions}")
            
            abort(404)
        
        file_size = os.path.getsize(session_zip_path)
        print(f"📤 Sending file: {session_zip_path} ({file_size} bytes)")
        
        return send_file(
            session_zip_path,
            as_attachment=True,
            download_name=f'{session_id}.zip',
            mimetype='application/zip'
        )
        
    except Exception as e:
        logger.error(f"Error downloading session: {e}")
        print(f"❌ Download error: {e}")
        abort(500)

@app.route('/list-sessions', methods=['GET'])
def list_sessions():
    """List all sessions (no authentication required)"""
    print("📋 Listing all sessions")
    
    try:
        metadata = load_metadata()
        
        sessions = []
        for session_id, data in metadata.items():
            sessions.append({
                'session_id': session_id,
                'user_id': data.get('user_id'),
                'upload_timestamp': data.get('upload_timestamp'),
                'size': data.get('size'),
                'file_exists': os.path.exists(data.get('file_path', ''))
            })
        
        print(f"📊 Found {len(sessions)} sessions")
        
        return jsonify({
            'sessions': sessions,
            'count': len(sessions),
            'storage_dir': SESSIONS_DIR,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        abort(500)

@app.route('/storage-info', methods=['GET'])
def storage_info():
    """Get storage information"""
    print("💾 Getting storage info")
    
    try:
        total_size = 0
        file_count = 0
        
        for root, dirs, files in os.walk(SESSIONS_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                if os.path.exists(file_path):
                    total_size += os.path.getsize(file_path)
                    file_count += 1
        
        session_count = len([d for d in os.listdir(SESSIONS_DIR) if os.path.isdir(os.path.join(SESSIONS_DIR, d)) and d.startswith('session_')])
        
        print(f"📊 Storage: {total_size} bytes, {file_count} files, {session_count} sessions")
        
        return jsonify({
            'storage_dir': SESSIONS_DIR,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'file_count': file_count,
            'session_count': session_count,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting storage info: {e}")
        abort(500)

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad request'}), 400

@app.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden'}), 403

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("🚀 Starting WOAT Session Server")
    print(f"📁 Sessions directory: {os.path.abspath(SESSIONS_DIR)}")
    print(f"🌐 Server starting on http://0.0.0.0:8080")
    print("🔧 Debug mode enabled - all requests will be logged")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=8080)
