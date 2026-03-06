const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const app = express();
// Use environment variables so production can bind to external interfaces/ports
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3215;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare';
let isMongoConnected = false;

// Connect to MongoDB
if (MONGODB_URI && MONGODB_URI !== 'mongodb://localhost:27017/healthcare') {
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('✅ MongoDB connected successfully');
        isMongoConnected = true;
    }).catch(err => {
        console.error('⚠️ MongoDB connection error:', err.message);
        console.log('⚠️ Using mock data for patient/prescription information');
        isMongoConnected = false;
    });
} else {
    console.log('ℹ️ No MongoDB URI configured, using mock data');
    console.log('ℹ️ Set MONGODB_URI environment variable to connect to database');
}

// MongoDB Models (only define if connection is active)
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor', 'admin', 'medical_store', 'lab_centre'], required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: String,
    avatarUrl: String,
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const PatientSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dateOfBirth: Date,
    gender: String,
    bloodType: String,
    allergies: [String],
    chronicConditions: [String],
    emergencyContactName: String,
    emergencyContactPhone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    latitude: Number,
    longitude: Number,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'patients' });

const DoctorSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialty: { type: String, required: true },
    qualification: { type: String, required: true },
    experienceYears: { type: Number, required: true },
    hospital: String,
    languages: [String],
    consultationFee: { type: Number, required: true },
    about: String,
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'doctors' });

const PrescriptionSchema = new mongoose.Schema({
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    diagnosis: { type: String, required: true },
    diagnosedBy: String,
    diagnosedDate: Date,
    medications: [{
        name: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
        instructions: String
    }],
    additionalInstructions: String,
    followUpDate: Date,
    nextVisitNeeded: { type: Boolean, default: false },
    nextVisitDate: Date,
    suggestedNextVisit: String,
    linkedMedicalStoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalStore' },
    isValid: { type: Boolean, default: true },
    validUntil: Date,
    status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'prescriptions' });

// Create models
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Patient = mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
const Doctor = mongoose.models.Doctor || mongoose.model('Doctor', DoctorSchema);
const Prescription = mongoose.models.Prescription || mongoose.model('Prescription', PrescriptionSchema);

app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Production-friendly: allow any origin by default so external dashboards can connect
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Max-Age', '86400');

    // Handle preflight OPTIONS requests  
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    next();
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// Test route for diagnosis
app.get('/test', (req, res) => {
    res.send(`<html>
        <head><title>Test</title></head>
        <body style="font-family: Arial; background: #0d1117; color: #e6edf3; padding: 20px;">
            <h1>Server is working!</h1>
            <p>If you see this, the server is responding correctly.</p>
            <p>Now trying to load the main page...</p>
            <a href="/">Go to main page</a>
        </body>
    </html>`);
});

// Storage configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uniqueId = req.body.uniqueId || 'default';
        const dir = path.join(__dirname, 'sessions', uniqueId);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Initialize SQLite database
const db = new sqlite3.Database('sessions.db');

// Create sessions table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        secret_key TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bot_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        contact TEXT,
        message TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Bot processes storage
const activeBots = new Map();
const sessionCreators = new Map();
const sessionMessageContext = new Map();

// Import session creator
const LinkedInSessionCreator = require('./manual_session_creator.js');

// Function to sanitize session ID for file system
function sanitizeSessionId(sessionId) {
    return sessionId
        .replace(/[@]/g, '_at_')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\./g, '_dot_')
        .replace(/\s+/g, '_');
}

function saveBotEvent(sessionId, eventType, contact, message, source) {
    const safeMessage = (message || '').toString().slice(0, 2000);
    const safeContact = (contact || '').toString().slice(0, 255);
    const safeSource = (source || '').toString().slice(0, 50);

    db.run(
        'INSERT INTO bot_events (session_id, event_type, contact, message, source) VALUES (?, ?, ?, ?, ?)',
        [sessionId, eventType, safeContact, safeMessage, safeSource],
        (err) => {
            if (err) {
                console.error('Failed to save bot event:', err.message);
            }
        }
    );
}

function parseAndStoreBotOutput(sessionId, rawOutput, source = 'whatsapp') {
    if (!rawOutput) return;

    const lines = rawOutput
        .toString()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!sessionMessageContext.has(sessionId)) {
        sessionMessageContext.set(sessionId, { incomingContact: null });
    }

    const ctx = sessionMessageContext.get(sessionId);

    for (const line of lines) {
        const fromMatch = line.match(/^👤 From:\s*(.+?)\s*\((.+?)\)\s*$/);
        if (fromMatch) {
            ctx.incomingContact = `${fromMatch[1]} (${fromMatch[2]})`;
            continue;
        }

        const incomingMsgMatch = line.match(/^💬 Message:\s*(.+)$/);
        if (incomingMsgMatch) {
            saveBotEvent(sessionId, 'received', ctx.incomingContact || 'Unknown', incomingMsgMatch[1], source);
            continue;
        }

        const outgoingMsgMatch = line.match(/^📤 Sending reply to\s*(.+?):\s*(.+)$/);
        if (outgoingMsgMatch) {
            saveBotEvent(sessionId, 'sent', outgoingMsgMatch[1], outgoingMsgMatch[2], source);
            continue;
        }

        const bulkSentMatch = line.match(/^\[\d+\/(\d+)\]\s*Processing:\s*(.+)$/);
        if (bulkSentMatch) {
            saveBotEvent(sessionId, 'bulk-processing', bulkSentMatch[2], 'Bulk contact processing started', source);
            continue;
        }

        if (line.startsWith('✅ Reply sent to')) {
            saveBotEvent(sessionId, 'status', '', line, source);
            continue;
        }
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'bot_interface.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    const origin = req.headers.origin;
    console.log('Health check requested from:', origin || 'direct access');
    
    // Explicitly set CORS headers again for health check
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
    
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        cors: 'enabled',
        origin: origin || 'none'
    });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
    const origin = req.headers.origin;
    console.log('CORS test requested from:', origin || 'direct access');
    
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
    
    res.json({
        message: 'CORS is working correctly',
        origin: origin || 'none',
        userAgent: req.headers['user-agent'] || 'unknown',
        timestamp: new Date().toISOString(),
        headers: req.headers
    });
});

// Upload LinkedIn session
app.post('/upload-session', upload.single('sessionFile'), (req, res) => {
    const { uniqueId } = req.body;
    
    console.log(`Session upload request for: ${uniqueId}`);
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Session ID is required' });
    }
    
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Session file is required' });
    }
    
    try {
        // Parse uploaded JSON file
        const sessionData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
        
        // Validate session structure
        if (!sessionData.cookies || !Array.isArray(sessionData.cookies)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid session file format. Must contain cookies array.' 
            });
        }
        
        // Save to root directory for all bots to use
        const rootSessionFile = path.join(__dirname, 'linkedin_session.json');
        fs.writeFileSync(rootSessionFile, JSON.stringify(sessionData, null, 2));
        
                // Also save to session-specific directory
                const sanitizedId = sanitizeSessionId(uniqueId);
                const sessionLinkedinDir = path.join(__dirname, 'sessions', sanitizedId, 'linkedin');
                const sessionLeadsDir = path.join(__dirname, 'sessions', sanitizedId, 'leads');
        
                if (!fs.existsSync(sessionLinkedinDir)) {
                    fs.mkdirSync(sessionLinkedinDir, { recursive: true });
                }
                if (!fs.existsSync(sessionLeadsDir)) {
                    fs.mkdirSync(sessionLeadsDir, { recursive: true });
                }
        
                const sessionFile = path.join(sessionLinkedinDir, 'linkedin_session.json');
                const leadsSessionFile = path.join(sessionLeadsDir, 'linkedin_session.json');
                fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
                fs.writeFileSync(leadsSessionFile, JSON.stringify(sessionData, null, 2));
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        console.log(`LinkedIn session uploaded successfully with ${sessionData.cookies.length} cookies`);
        
        res.json({ 
            success: true, 
            message: `LinkedIn session uploaded successfully. Found ${sessionData.cookies.length} cookies.`,
            cookieCount: sessionData.cookies.length
        });
    } catch (error) {
        console.error('Error processing session file:', error);
        
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(400).json({ 
            success: false, 
            message: 'Error processing session file: ' + error.message 
        });
    }
});

// Create LinkedIn session
app.post('/create-session', (req, res) => {
    const { uniqueId } = req.body;
    
    console.log(`Session creation request for: ${uniqueId}`);
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Session ID is required' });
    }
    
    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId);
    
    // Create session directory
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Copy manual session creator to session directory
    const originalCreator = path.join(__dirname, 'manual_session_creator.js');
    const sessionCreator = path.join(sessionDir, 'manual_session_creator.js');
    if (fs.existsSync(originalCreator)) {
        fs.copyFileSync(originalCreator, sessionCreator);
    }
    
    // Copy package.json for dependencies
    const originalPackage = path.join(__dirname, 'package.json');
    const sessionPackage = path.join(sessionDir, 'package.json');
    if (fs.existsSync(originalPackage)) {
        fs.copyFileSync(originalPackage, sessionPackage);
    }
    
    // Check if session creator is already running
    const creatorKey = `creator_${uniqueId}`;
    if (sessionCreators.has(creatorKey)) {
        return res.json({ 
            success: false, 
            message: 'Session creator is already running for this session'
        });
    }
    
    console.log(`Starting session creator for: ${uniqueId}`);
    console.log(`Session directory: ${sessionDir}`);
    
    // Start session creator process
    const creatorProcess = spawn('node', ['manual_session_creator.js'], {
        cwd: sessionDir,
        env: { 
            ...process.env, 
            SESSION_ID: uniqueId,
            SANITIZED_SESSION_ID: sanitizedId
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const logFile = path.join(sessionDir, 'session_creator.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    logStream.write(`\n=== Session Creator Started: ${new Date().toISOString()} ===\n`);
    
    creatorProcess.stdout.on('data', (data) => {
        console.log(`Session Creator ${uniqueId}:`, data.toString().trim());
        logStream.write(`[STDOUT] ${data}`);
    });
    
    creatorProcess.stderr.on('data', (data) => {
        console.error(`Session Creator ${uniqueId} ERROR:`, data.toString().trim());
        logStream.write(`[STDERR] ${data}`);
    });
    
    creatorProcess.on('close', (code) => {
        console.log(`Session creator ${uniqueId} exited with code ${code}`);
        logStream.write(`\n=== Process Exited: ${code} at ${new Date().toISOString()} ===\n`);
        logStream.end();
        sessionCreators.delete(creatorKey);
    });
    
    creatorProcess.on('error', (error) => {
        console.error(`Session creator ${uniqueId} process error:`, error);
        logStream.write(`\n=== Process Error: ${error.message} at ${new Date().toISOString()} ===\n`);
        logStream.end();
        sessionCreators.delete(creatorKey);
    });
    
    sessionCreators.set(creatorKey, creatorProcess);
    
    res.json({ 
        success: true, 
        message: 'LinkedIn session creator started successfully. Please complete login in the browser.',
        sessionDir: sanitizedId,
        instructions: 'A browser will open. Please log in to LinkedIn and wait for the session to be saved.',
        logFile: 'session_creator.log'
    });
});

// Verify unique ID and secret key
app.post('/verify-session', (req, res) => {
    const { uniqueId, secretKey, email } = req.body;
    
    db.get('SELECT * FROM sessions WHERE id = ? AND secret_key = ?', [uniqueId, secretKey], (err, row) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
            return;
        }
        
        if (row) {
            // Update last used timestamp
            if (email && email !== row.email) {
                db.run('UPDATE sessions SET last_used = CURRENT_TIMESTAMP, email = ? WHERE id = ?', [email, uniqueId]);
            } else {
                db.run('UPDATE sessions SET last_used = CURRENT_TIMESTAMP WHERE id = ?', [uniqueId]);
            }
            res.json({ success: true, message: 'Session verified' });
        } else {
            // Check if it's a new session
            db.get('SELECT * FROM sessions WHERE id = ?', [uniqueId], (err, existingRow) => {
                if (existingRow) {
                    res.json({ success: false, message: 'Invalid secret key' });
                } else {
                    // Create new session
                    db.run('INSERT INTO sessions (id, secret_key, email) VALUES (?, ?, ?)', [uniqueId, secretKey, email], function(err) {
                        if (err) {
                            res.json({ success: false, message: 'Error creating session' });
                        } else {
                            res.json({ success: true, message: 'New session created successfully!' });
                        }
                    });
                }
            });
        }
    });
});

// Start WhatsApp bot
app.post('/start-whatsapp', upload.none(), (req, res) => {
    const { uniqueId, personality, contacts, excludeContacts } = req.body;
    
    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'whatsapp');
    
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Write configuration files
    fs.writeFileSync(path.join(sessionDir, 'personality.txt'), personality || 'Default personality');
    fs.writeFileSync(path.join(sessionDir, 'contacts.txt'), contacts || 'ALL');
    fs.writeFileSync(path.join(sessionDir, 'exclude_contacts.txt'), excludeContacts || '');
    fs.writeFileSync(path.join(sessionDir, 'original_session_id.txt'), uniqueId);
    
    // Copy bot files to session directory
    const originalBot = path.join(__dirname, 'smart_whatsapp_bot.js');
    const sessionBot = path.join(sessionDir, 'smart_whatsapp_bot.js');
    if (fs.existsSync(originalBot)) {
        fs.copyFileSync(originalBot, sessionBot);
    }
    
    const originalGemini = path.join(__dirname, 'gemini_bot.py');
    const sessionGemini = path.join(sessionDir, 'gemini_bot.py');
    if (fs.existsSync(originalGemini)) {
        fs.copyFileSync(originalGemini, sessionGemini);
    }
    
    // Check if bot is already running
    const botKey = `whatsapp_${uniqueId}`;
    if (activeBots.has(botKey)) {
        res.json({ success: false, message: 'WhatsApp bot is already running for this session' });
        return;
    }
    
    // Start WhatsApp bot process
    const botProcess = spawn('node', ['smart_whatsapp_bot.js'], {
        cwd: sessionDir,
        env: { 
            ...process.env, 
            SESSION_ID: uniqueId,
            SANITIZED_SESSION_ID: sanitizedId
        }
    });
    
    // Log bot output
    const logFile = path.join(sessionDir, 'bot.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    botProcess.stdout.on('data', (data) => {
        logStream.write(data);
        const output = data.toString();
        parseAndStoreBotOutput(uniqueId, output, 'whatsapp');
        console.log(`WhatsApp Bot ${uniqueId}:`, output.trim());
    });
    
    botProcess.stderr.on('data', (data) => {
        logStream.write(data);
        const output = data.toString();
        parseAndStoreBotOutput(uniqueId, output, 'whatsapp');
        console.error(`WhatsApp Bot ${uniqueId} Error:`, output.trim());
    });
    
    botProcess.on('close', (code) => {
        console.log(`WhatsApp bot ${uniqueId} exited with code ${code}`);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    botProcess.on('error', (error) => {
        console.error(`WhatsApp bot ${uniqueId} spawn error:`, error);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    activeBots.set(botKey, botProcess);
    
    res.json({ 
        success: true, 
        message: '⏳ WhatsApp bot starting... Please wait 60-120 seconds for Chrome to initialize. Monitor the server logs for progress.',
        sessionDir: sanitizedId,
        notice: 'Chrome initialization can take time on first run. This is normal.'
    });
});

// Bulk WhatsApp Messaging
app.post('/bulk-whatsapp', upload.single('bulkFile'), async (req, res) => {
    const { uniqueId, personality, contacts, excludeContacts } = req.body;
    
    console.log(`Bulk WhatsApp request for session: ${uniqueId}`);
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Missing uniqueId' });
    }
    
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    try {
        const sanitizedId = sanitizeSessionId(uniqueId);
        const filePath = req.file.path;
        const fileName = req.file.originalname;
        const ext = path.extname(fileName || '').toLowerCase();
        
        let contactData = [];
        const excelExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.xlsv'];
        const fileBuffer = fs.readFileSync(filePath);
        const hasZipSignature = fileBuffer.length >= 4 &&
            fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
        const hasOleSignature = fileBuffer.length >= 8 &&
            fileBuffer[0] === 0xD0 && fileBuffer[1] === 0xCF && fileBuffer[2] === 0x11 && fileBuffer[3] === 0xE0;
        const sample = fileBuffer.subarray(0, Math.min(fileBuffer.length, 2048));
        let nullByteCount = 0;
        for (const byte of sample) {
            if (byte === 0x00) {
                nullByteCount++;
            }
        }
        const nullRatio = sample.length > 0 ? nullByteCount / sample.length : 0;
        const looksBinary = nullRatio > 0.01;
        const parseAsExcel = excelExtensions.includes(ext) || hasZipSignature || hasOleSignature || looksBinary;
        const detectedFormat = parseAsExcel ? 'excel' : (ext === '.csv' ? 'csv' : 'unknown');

        console.log(`\n📦 Upload file format detection:`);
        console.log(`  Name: ${fileName}`);
        console.log(`  Extension: ${ext || '(none)'}`);
        console.log(`  ZIP signature: ${hasZipSignature}`);
        console.log(`  OLE signature: ${hasOleSignature}`);
        console.log(`  Null-byte ratio: ${nullRatio.toFixed(4)}`);
        console.log(`  Selected parser: ${detectedFormat}`);
        
        // Parse Excel/CSV file
        if (parseAsExcel) {
            try {
                const XLSX = require('xlsx');
                const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Get sheet range for debugging
                const range = worksheet['!ref'];
                console.log(`\n📊 Excel Analysis for ${fileName}:`);
                console.log(`  Sheet: ${sheetName}`);
                console.log(`  Range: ${range}`);
                
                // Read as rows (headerless tolerant)
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
                
                console.log(`  Total rows: ${rows.length}`);
                console.log(`  First 5 rows (raw):`);
                rows.slice(0, 5).forEach((row, idx) => {
                    console.log(`    Row ${idx}: [${row.map(c => `"${c}"`).join(', ')}]`);
                });
                
                contactData = [];
                let phoneColIndex = 0;
                let descColIndex = 1;
                let startIndex = 0;
                let skippedRows = 0;
                
                // Smart header detection
                if (rows.length > 0) {
                    const firstRow = rows[0];
                    
                    // Check each cell in first row for header keywords
                    for (let colIdx = 0; colIdx < firstRow.length; colIdx++) {
                        const cellValue = String(firstRow[colIdx] || '').toLowerCase().trim();
                        
                        if (/phone|mobile|contact|number|whatsapp|cell/i.test(cellValue)) {
                            phoneColIndex = colIdx;
                            console.log(`  Detected phone column at index ${colIdx}: "${cellValue}"`);
                        }
                        if (/description|message|text|content|details|requirement|query/i.test(cellValue)) {
                            descColIndex = colIdx;
                            console.log(`  Detected description column at index ${colIdx}: "${cellValue}"`);
                        }
                    }
                    
                    // Check if first row is a header (has header keywords but no actual phone number)
                    const firstCellStr = String(firstRow[phoneColIndex] || '').toLowerCase();
                    const hasHeaderKeyword = /phone|mobile|contact|number/i.test(firstCellStr);
                    const hasDigits = /\d{8,}/.test(String(firstRow[phoneColIndex] || ''));
                    
                    if (hasHeaderKeyword && !hasDigits) {
                        console.log(`  ✓ Header row detected, starting from row 2`);
                        startIndex = 1;
                    } else {
                        console.log(`  ✓ No header detected, processing all rows`);
                    }
                }
                
                console.log(`  Phone column: ${phoneColIndex}, Description column: ${descColIndex}`);
                console.log(`\n🔍 Parsing contacts...`);
                
                // Process rows with detailed logging
                for (let i = startIndex; i < rows.length; i++) {
                    const row = rows[i];
                    
                    // Skip completely empty rows
                    if (!row || row.length === 0 || row.every(cell => !cell)) {
                        skippedRows++;
                        continue;
                    }
                    
                    const phoneCell = String(row[phoneColIndex] || '').trim();
                    const descCell = String(row[descColIndex] || '').trim();
                    
                    // Extract digits from phone
                    const digits = phoneCell.replace(/\D/g, '');
                    
                    if (digits.length >= 8) {
                        contactData.push({ 
                            phone: phoneCell, 
                            description: descCell || 'No description provided' 
                        });
                        console.log(`  ✓ Row ${i + 1}: "${phoneCell}" → ${digits} (${descCell.substring(0, 30)}${descCell.length > 30 ? '...' : ''})`);
                    } else if (phoneCell) {
                        console.log(`  ✗ Row ${i + 1}: "${phoneCell}" → Invalid (only ${digits.length} digits)`);
                        skippedRows++;
                    }
                }
                
                console.log(`\n📋 Excel Parsing Summary:`);
                console.log(`  Valid contacts: ${contactData.length}`);
                console.log(`  Skipped rows: ${skippedRows}`);
                
            } catch (err) {
                console.error('Excel parsing error:', err.message);
                return res.status(400).json({ success: false, message: `Error parsing Excel: ${err.message}` });
            }
        } else if (ext === '.csv') {
            try {
                const csv = require('csv-parser');
                const fs = require('fs');
                
                console.log(`\n📄 CSV Analysis for ${fileName}:`);
                
                // Try CSV parser with headers first
                await new Promise((resolve, reject) => {
                    fs.createReadStream(filePath)
                        .pipe(csv())
                        .on('data', (row) => {
                            const phone = String(row.phone_number || row.phoneNumber || row['Phone Number'] || row.phone || row.Phone || '').trim();
                            const description = String(row.description || row.Description || row.message || row.Message || '').trim();
                            const digits = phone.replace(/\D/g, '');
                            if (digits.length >= 8) {
                                contactData.push({ phone, description: description || 'No description provided' });
                                console.log(`  ✓ CSV: "${phone}" → ${digits}`);
                            }
                        })
                        .on('end', resolve)
                        .on('error', reject);
                });
                
                console.log(`  CSV parser found ${contactData.length} contacts`);
                
                // Fallback: treat as headerless CSV (first column = phone, second = description)
                if (contactData.length === 0) {
                    console.log(`  🔄 Trying headerless CSV parsing...`);
                    const text = fs.readFileSync(filePath, 'utf8');
                    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
                    
                    console.log(`    CSV lines: ${lines.length}`);
                    console.log(`    First 3 lines:`);
                    lines.slice(0, 3).forEach((line, idx) => {
                        console.log(`      Line ${idx}: "${line}"`);
                    });
                    
                    let csvStartIndex = 0;
                    
                    // Check for header row
                    if (lines.length > 0 && /phone|mobile|contact|number/i.test(lines[0])) {
                        console.log(`    ✓ Header detected, skipping first line`);
                        csvStartIndex = 1;
                    }
                    
                    for (let i = csvStartIndex; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        // Try different delimiters
                        let parts = line.split(';');
                        if (parts.length < 2) parts = line.split(',');
                        if (parts.length < 2) parts = line.split('\t');
                        if (parts.length < 2) parts = line.split('|');
                        
                        const phone = String(parts[0] || '').trim();
                        const description = String(parts[1] || '').trim();
                        const digits = phone.replace(/\D/g, '');
                        
                        if (digits.length >= 8) {
                            contactData.push({ phone, description: description || 'No description provided' });
                            console.log(`    ✓ Line ${i + 1}: "${phone}" → ${digits}`);
                        } else if (phone) {
                            console.log(`    ✗ Line ${i + 1}: "${phone}" → Invalid (only ${digits.length} digits)`);
                        }
                    }
                    console.log(`    CSV fallback found ${contactData.length} contacts`);
                }
                
                console.log(`\n📋 CSV Parsing Summary:`);
                console.log(`  Valid contacts: ${contactData.length}`);
                
            } catch (err) {
                console.error('CSV parsing error:', err.message);
                return res.status(400).json({ success: false, message: `Error parsing CSV: ${err.message}` });
            }
        } else if (ext === '.pdf') {
            try {
                const pdfParse = require('pdf-parse');
                
                console.log(`\n📄 PDF Analysis for ${fileName}:`);
                console.log(`  File size: ${fileBuffer.length} bytes`);
                
                const data = await pdfParse(fileBuffer);
                const pdfText = data.text || '';
                
                console.log(`  Total pages: ${data.numpages}`);
                console.log(`  Total characters: ${pdfText.length}`);
                console.log(`\n📖 PDF Content (first 500 chars):`);
                console.log(`  ${pdfText.substring(0, 500)}${pdfText.length > 500 ? '...' : ''}`);
                
                // Parse PDF text for phone numbers and descriptions
                const lines = pdfText.split(/\r?\n/).filter(l => l.trim().length > 0);
                
                console.log(`\n  Total non-empty lines: ${lines.length}`);
                console.log(`  First 5 lines:`);
                lines.slice(0, 5).forEach((line, idx) => {
                    console.log(`    Line ${idx}: "${line}"`);
                });
                
                // Smart parsing: look for phone numbers and associated descriptions
                let skippedLines = 0;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // Extract phone number from the line using regex
                    const phoneMatch = line.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/);
                    
                    if (phoneMatch) {
                        const phoneStr = phoneMatch[0];
                        const digits = phoneStr.replace(/\D/g, '');
                        
                        if (digits.length >= 8) {
                            // Extract rest of line as description
                            const restOfLine = line.substring(phoneMatch.index + phoneStr.length).trim();
                            let description = restOfLine;
                            
                            // If no description on same line, try next line
                            if (!description && i + 1 < lines.length) {
                                const nextLine = lines[i + 1].trim();
                                // Check if next line is not a phone number itself
                                if (!nextLine.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/)) {
                                    description = nextLine;
                                }
                            }
                            
                            contactData.push({
                                phone: phoneStr,
                                description: description || 'No description provided'
                            });
                            
                            console.log(`  ✓ Line ${i + 1}: "${phoneStr}" → ${digits} (${(description || 'No desc').substring(0, 35)}${(description || '').length > 35 ? '...' : ''})`);
                        } else {
                            console.log(`  ✗ Line ${i + 1}: "${phoneStr}" → Invalid (only ${digits.length} digits)`);
                            skippedLines++;
                        }
                    }
                }
                
                console.log(`\n📋 PDF Parsing Summary:`);
                console.log(`  Valid contacts: ${contactData.length}`);
                console.log(`  Skipped lines: ${skippedLines}`);
                
            } catch (err) {
                console.error('PDF parsing error:', err.message);
                return res.status(400).json({ success: false, message: `Error parsing PDF: ${err.message}` });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Unsupported file format. Use .xlsx, .xls, .xlsm, .xlsb, .xlsv, .csv, or .pdf' });
        }
        
        if (contactData.length === 0) {
            // Log the parsing failure into the session folder for visibility
            const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'whatsapp');
            try {
                if (!fs.existsSync(sessionDir)) {
                    fs.mkdirSync(sessionDir, { recursive: true });
                }
                const bulkLogPath = path.join(sessionDir, 'bulk_requests.log');
                const errorMsg = `
═══════════════════════════════════════════════════════════════
[${new Date().toISOString()}] ❌ PARSING ERROR
File: ${fileName}
Extension: ${ext}
Size: ${req.file.size} bytes
Error: No valid contacts found - phone numbers must have at least 8 digits

💡 Troubleshooting Tips:
1. First column/field should contain phone numbers (e.g., 919876543210 or +91 98765 43210)
2. Second column/field should contain description/message (optional)
3. Phone numbers must have at least 8 digits
4. Supported formats: .xlsx, .xls, .xlsm, .xlsb, .xlsv, .csv, .pdf
5. Headers are optional - will be auto-detected

📋 Example Excel structure:
   Column A (Phone)  |  Column B (Description)
   919876543210      |  Need website development
   +91 98765 43210   |  Looking for mobile app
   
📋 Example CSV structure:
   919876543210,Need website development
   +91 98765 43210,Looking for mobile app
   
📋 Example PDF structure:
   919876543210 Need website development
   +91 98765 43210 Looking for mobile app

Check server logs for detailed parsing information.
═══════════════════════════════════════════════════════════════
`;
                fs.appendFileSync(bulkLogPath, errorMsg);
                console.log(`\n❌ Detailed error logged to: ${bulkLogPath}`);
            } catch (logErr) {
                console.error('Failed to write bulk parsing error log:', logErr.message);
            }
            
            console.log(`\n❌ No valid contacts found in ${fileName}`);
            console.log(`   Please ensure:`);
            console.log(`   - First column contains phone numbers with at least 8 digits`);
            console.log(`   - Numbers can be formatted like: 919876543210 or +91 98765 43210`);
            console.log(`   - Second column contains description (optional)`);
            
            return res.status(400).json({ 
                success: false, 
                message: 'No valid contacts found in file. Phone numbers must have at least 8 digits. Check bulk_requests.log for detailed troubleshooting guide.' 
            });
        }
        
        // Save contact data and bot config to session directory for bot to process
        const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'whatsapp');
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        // Keep a copy of the uploaded file alongside results for traceability
        const normalizedUploadExt = detectedFormat === 'excel' ? '.xlsx' : (ext || path.extname(fileName) || '.csv');
        const savedUploadPath = path.join(sessionDir, `bulk_upload${normalizedUploadExt}`);
        try {
            fs.copyFileSync(filePath, savedUploadPath);
        } catch (copyErr) {
            console.error('Error copying uploaded bulk file:', copyErr.message);
        }

        // Persist bot personality/contact preferences so the JS bot can load them
        fs.writeFileSync(path.join(sessionDir, 'personality.txt'), personality || 'Default personality');
        fs.writeFileSync(path.join(sessionDir, 'contacts.txt'), contacts || 'ALL');
        fs.writeFileSync(path.join(sessionDir, 'exclude_contacts.txt'), excludeContacts || '');
        fs.writeFileSync(path.join(sessionDir, 'original_session_id.txt'), uniqueId);

        // Log the bulk request for debugging and audits
        const bulkLogPath = path.join(sessionDir, 'bulk_requests.log');
        fs.appendFileSync(bulkLogPath, `[${new Date().toISOString()}] upload=${fileName} savedAs=${path.basename(savedUploadPath)} contacts=${contactData.length} personalityChars=${(personality || '').length}\n`);

        const bulkDataFile = path.join(sessionDir, 'bulk_contacts.json');
        fs.writeFileSync(bulkDataFile, JSON.stringify({
            contacts: contactData,
            createdAt: new Date().toISOString(),
            totalCount: contactData.length,
            sourceFile: path.basename(savedUploadPath)
        }, null, 2));
        
        console.log(`Saved ${contactData.length} contacts to bulk_contacts.json`);

        // Copy bot files into session dir if missing (mirrors /start-whatsapp)
        const originalBot = path.join(__dirname, 'smart_whatsapp_bot.js');
        const sessionBot = path.join(sessionDir, 'smart_whatsapp_bot.js');
        if (fs.existsSync(originalBot)) {
            fs.copyFileSync(originalBot, sessionBot);
        }

        const originalGemini = path.join(__dirname, 'gemini_bot.py');
        const sessionGemini = path.join(sessionDir, 'gemini_bot.py');
        if (fs.existsSync(originalGemini)) {
            fs.copyFileSync(originalGemini, sessionGemini);
        }

        const originalPackage = path.join(__dirname, 'package.json');
        const sessionPackage = path.join(sessionDir, 'package.json');
        if (fs.existsSync(originalPackage) && !fs.existsSync(sessionPackage)) {
            fs.copyFileSync(originalPackage, sessionPackage);
        }

        // Start the WhatsApp bot if it is not already running for this session
        const botKey = `whatsapp_${uniqueId}`;
        if (!activeBots.has(botKey)) {
            console.log(`Starting WhatsApp bot for bulk request: ${uniqueId}`);
            const botProcess = spawn('node', ['smart_whatsapp_bot.js'], {
                cwd: sessionDir,
                env: {
                    ...process.env,
                    SESSION_ID: uniqueId,
                    SANITIZED_SESSION_ID: sanitizedId
                }
            });

            const logFile = path.join(sessionDir, 'bot.log');
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });

            botProcess.stdout.on('data', (data) => {
                const msg = data.toString();
                logStream.write(`[STDOUT] ${msg}`);
                parseAndStoreBotOutput(uniqueId, msg, 'bulk');
                console.log(`WhatsApp Bot (${uniqueId}): ${msg}`);
            });

            botProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                logStream.write(`[STDERR] ${msg}`);
                parseAndStoreBotOutput(uniqueId, msg, 'bulk');
                console.error(`WhatsApp Bot Error (${uniqueId}): ${msg}`);
            });

            botProcess.on('close', (code) => {
                logStream.write(`\nBot process exited with code ${code}\n`);
                activeBots.delete(botKey);
            });

            botProcess.on('error', (error) => {
                logStream.write(`\nBot process error: ${error.message}\n`);
                activeBots.delete(botKey);
            });

            activeBots.set(botKey, botProcess);
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json({ 
            success: true, 
            message: `Bulk messaging prepared for ${contactData.length} contacts`,
            totalContacts: contactData.length,
            sessionDir: sanitizedId
        });
        
    } catch (error) {
        console.error('Bulk WhatsApp error:', error);
        res.status(500).json({ 
            success: false, 
            message: `Server error: ${error.message}` 
        });
    }
});

// Download bulk WhatsApp results (Excel preferred, JSON fallback)
app.get('/bulk-whatsapp/results/:uniqueId', (req, res) => {
    const { uniqueId } = req.params;
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Missing uniqueId' });
    }

    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'whatsapp');

    const excelPath = path.join(sessionDir, 'bulk_results.xlsx');
    const jsonPath = path.join(sessionDir, 'bulk_message_results.json');

    try {
        if (fs.existsSync(excelPath)) {
            const downloadName = `bulk_results_${sanitizedId}.xlsx`;
            return res.download(excelPath, downloadName);
        }

        if (fs.existsSync(jsonPath)) {
            const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            return res.json({ success: true, from: 'json', ...payload });
        }

        return res.status(404).json({ success: false, message: 'No bulk results available yet' });
    } catch (err) {
        console.error('Error serving bulk results:', err.message);
        return res.status(500).json({ success: false, message: `Error reading results: ${err.message}` });
    }
});

// Send single WhatsApp message with custom text
app.post('/send-whatsapp-message', upload.none(), async (req, res) => {
    const { uniqueId, phone, message, personality } = req.body;
    
    console.log(`Single WhatsApp message request for session: ${uniqueId}`);
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Missing uniqueId' });
    }
    
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Missing phone number' });
    }
    
    if (!message) {
        return res.status(400).json({ success: false, message: 'Missing message content' });
    }
    
    try {
        const sanitizedId = sanitizeSessionId(uniqueId);
        const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'whatsapp');
        
        // Ensure session directory exists
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Create a temporary bulk contacts file with single entry
        const bulkContactsFile = path.join(sessionDir, `single_msg_${Date.now()}.json`);
        const contactData = [{
            phone: phone,
            customMessage: message
        }];
        
        fs.writeFileSync(bulkContactsFile, JSON.stringify(contactData));
        
        // Write configuration files
        fs.writeFileSync(path.join(sessionDir, 'personality.txt'), personality || 'Professional assistant');
        fs.writeFileSync(path.join(sessionDir, 'contacts.txt'), 'ALL');
        fs.writeFileSync(path.join(sessionDir, 'exclude_contacts.txt'), '');
        fs.writeFileSync(path.join(sessionDir, 'original_session_id.txt'), uniqueId);
        
        // Copy bot files to session directory if not exists
        const originalBot = path.join(__dirname, 'smart_whatsapp_bot.js');
        const sessionBot = path.join(sessionDir, 'smart_whatsapp_bot.js');
        if (fs.existsSync(originalBot) && !fs.existsSync(sessionBot)) {
            fs.copyFileSync(originalBot, sessionBot);
        }
        
        const originalGemini = path.join(__dirname, 'gemini_bot.py');
        const sessionGemini = path.join(sessionDir, 'gemini_bot.py');
        if (fs.existsSync(originalGemini) && !fs.existsSync(sessionGemini)) {
            fs.copyFileSync(originalGemini, sessionGemini);
        }
        
        // Copy package.json if needed
        const originalPackage = path.join(__dirname, 'package.json');
        const sessionPackage = path.join(sessionDir, 'package.json');
        if (fs.existsSync(originalPackage) && !fs.existsSync(sessionPackage)) {
            fs.copyFileSync(originalPackage, sessionPackage);
        }
        
        // Process the message using the WhatsApp bot's bulk processing logic
        const SmartWhatsAppBot = require('./smart_whatsapp_bot.js');
        
        // Mark the file for processing
        fs.writeFileSync(
            path.join(sessionDir, 'bulk_contacts.json'),
            JSON.stringify(contactData)
        );
        
        res.json({ 
            success: true, 
            message: 'Message queued for sending',
            phone: phone,
            sessionDir: sanitizedId
        });
        
        console.log(`✅ Single message queued for ${phone}`);
        
        // Cleanup temp file after a delay
        setTimeout(() => {
            try {
                if (fs.existsSync(bulkContactsFile)) {
                    fs.unlinkSync(bulkContactsFile);
                }
            } catch (err) {
                console.error('Error cleaning up temp file:', err.message);
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error sending single WhatsApp message:', error);
        return res.status(500).json({ 
            success: false, 
            message: `Server error: ${error.message}` 
        });
    }
});

// Send patient prescription reminder
app.post('/send-patient-reminder', upload.none(), async (req, res) => {
    const { uniqueId, patientId, prescriptionId, reminderType } = req.body;
    
    console.log(`Patient reminder request for session: ${uniqueId}, patient: ${patientId}`);
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Missing uniqueId' });
    }
    
    if (!patientId) {
        return res.status(400).json({ success: false, message: 'Missing patientId' });
    }
    
    try {
        const sanitizedId = sanitizeSessionId(uniqueId);
        const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'whatsapp');
        
        // Ensure session directory exists
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Fetch patient and prescription data from database
        // Note: This is a mock implementation. Replace with actual MongoDB queries.
        const patientData = await fetchPatientData(patientId);
        const prescriptionData = prescriptionId ? await fetchPrescriptionData(prescriptionId) : null;
        
        if (!patientData) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }
        
        // Craft the template message based on reminder type
        let message = '';
        const patientName = `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim() || 'Patient';
        const patientPhone = patientData.phone;
        
        if (!patientPhone) {
            return res.status(400).json({ success: false, message: 'Patient phone number not available' });
        }
        
        switch (reminderType) {
            case 'prescription':
                if (!prescriptionData) {
                    return res.status(400).json({ success: false, message: 'Prescription data required for this reminder type' });
                }
                message = craftPrescriptionReminderTemplate(patientName, prescriptionData);
                break;
            case 'appointment':
                message = craftAppointmentReminderTemplate(patientName);
                break;
            case 'followup':
                message = craftFollowUpReminderTemplate(patientName, prescriptionData);
                break;
            case 'medication':
                if (!prescriptionData) {
                    return res.status(400).json({ success: false, message: 'Prescription data required for medication reminder' });
                }
                message = craftMedicationReminderTemplate(patientName, prescriptionData);
                break;
            default:
                message = `Hello ${patientName},\n\nThis is a reminder from your healthcare provider. Please contact us if you have any questions.\n\nThank you!`;
        }
        
        // Create bulk contacts file with the patient info
        const contactData = [{
            phone: patientPhone,
            customMessage: message
        }];
        
        fs.writeFileSync(
            path.join(sessionDir, 'bulk_contacts.json'),
            JSON.stringify(contactData)
        );
        
        // Write configuration files
        fs.writeFileSync(path.join(sessionDir, 'personality.txt'), 'Professional healthcare assistant');
        fs.writeFileSync(path.join(sessionDir, 'contacts.txt'), 'ALL');
        fs.writeFileSync(path.join(sessionDir, 'exclude_contacts.txt'), '');
        fs.writeFileSync(path.join(sessionDir, 'original_session_id.txt'), uniqueId);
        
        // Copy bot files if needed
        const originalBot = path.join(__dirname, 'smart_whatsapp_bot.js');
        const sessionBot = path.join(sessionDir, 'smart_whatsapp_bot.js');
        if (fs.existsSync(originalBot) && !fs.existsSync(sessionBot)) {
            fs.copyFileSync(originalBot, sessionBot);
        }
        
        const originalGemini = path.join(__dirname, 'gemini_bot.py');
        const sessionGemini = path.join(sessionDir, 'gemini_bot.py');
        if (fs.existsSync(originalGemini) && !fs.existsSync(sessionGemini)) {
            fs.copyFileSync(originalGemini, sessionGemini);
        }
        
        res.json({ 
            success: true, 
            message: 'Patient reminder queued for sending',
            patient: patientName,
            phone: patientPhone,
            reminderType: reminderType,
            sessionDir: sanitizedId
        });
        
        console.log(`✅ Patient reminder queued for ${patientName} (${patientPhone})`);
        
    } catch (error) {
        console.error('Error sending patient reminder:', error);
        return res.status(500).json({ 
            success: false, 
            message: `Server error: ${error.message}` 
        });
    }
});

// Template crafting functions
function craftPrescriptionReminderTemplate(patientName, prescriptionData) {
    const medications = prescriptionData.medications || [];
    const medicationList = medications.map(med => 
        `• ${med.name} - ${med.dosage} (${med.frequency})`
    ).join('\n');
    
    return `Hello ${patientName},

This is a reminder about your prescription from Dr. ${prescriptionData.doctorName || 'your doctor'}.

📋 *Prescription Details:*
${prescriptionData.diagnosis ? `Diagnosis: ${prescriptionData.diagnosis}\n` : ''}
*Medications:*
${medicationList}

${prescriptionData.additionalInstructions ? `\n📝 Instructions: ${prescriptionData.additionalInstructions}\n` : ''}
${prescriptionData.followUpDate ? `\n📅 Follow-up scheduled: ${new Date(prescriptionData.followUpDate).toLocaleDateString()}\n` : ''}

Please ensure you take your medications as prescribed. If you have any questions or concerns, feel free to contact us.

Take care! 🏥`;
}

function craftAppointmentReminderTemplate(patientName) {
    return `Hello ${patientName},

This is a friendly reminder about your upcoming appointment with us.

Please make sure to:
• Arrive 10 minutes early
• Bring your medical records
• Bring any previous prescriptions

If you need to reschedule, please let us know in advance.

See you soon! 🏥`;
}

function craftFollowUpReminderTemplate(patientName, prescriptionData) {
    const followUpDate = prescriptionData?.followUpDate 
        ? new Date(prescriptionData.followUpDate).toLocaleDateString() 
        : 'soon';
    
    return `Hello ${patientName},

This is a reminder for your follow-up visit scheduled for ${followUpDate}.

It's important to attend this follow-up to monitor your progress and adjust your treatment if needed.

Please confirm your availability or let us know if you'd like to reschedule.

Looking forward to seeing you! 🏥`;
}

function craftMedicationReminderTemplate(patientName, prescriptionData) {
    const medications = prescriptionData.medications || [];
    const medicationList = medications.map(med => 
        `• ${med.name} - ${med.dosage}`
    ).join('\n');
    
    return `Hello ${patientName},

💊 *Medication Reminder*

Please remember to take your medications as prescribed:

${medicationList}

Regular medication is important for your recovery. Set daily reminders if needed!

Stay healthy! 🏥`;
}

// Database fetch functions - real MongoDB queries with fallback to mock data
async function fetchPatientData(patientId) {
    try {
        // If MongoDB is connected, try to fetch real data
        if (isMongoConnected) {
            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(patientId)) {
                console.error('❌ Invalid patient ID format:', patientId);
                return getMockPatientData(patientId);
            }

            const patient = await Patient.findById(patientId)
                .populate('userId')
                .lean()
                .exec();
            
            if (!patient) {
                console.log('⚠️ Patient not found in database:', patientId);
                return getMockPatientData(patientId);
            }

            // Get phone from User or fallback to emergency contact
            const phone = patient.userId?.phone || patient.emergencyContactPhone;
            
            if (!phone) {
                console.error('❌ No phone number available for patient:', patientId);
                return null;
            }

            console.log(`✅ Fetched patient data from database: ${patient.userId?.firstName} ${patient.userId?.lastName}`);
            
            return {
                _id: patient._id,
                firstName: patient.userId?.firstName || 'Patient',
                lastName: patient.userId?.lastName || '',
                phone: phone,
                email: patient.userId?.email,
                dateOfBirth: patient.dateOfBirth,
                gender: patient.gender,
                address: patient.address,
                city: patient.city,
                userId: patient.userId
            };
        }
    } catch (error) {
        console.error('❌ Error fetching patient data from database:', error.message);
    }
    
    // Fallback to mock data
    console.log('ℹ️ Using mock patient data for:', patientId);
    return getMockPatientData(patientId);
}

async function fetchPrescriptionData(prescriptionId) {
    try {
        // If MongoDB is connected, try to fetch real data
        if (isMongoConnected) {
            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
                console.error('❌ Invalid prescription ID format:', prescriptionId);
                return getMockPrescriptionData(prescriptionId);
            }

            const prescription = await Prescription.findById(prescriptionId)
                .populate({
                    path: 'doctorId',
                    populate: { path: 'userId' }
                })
                .lean()
                .exec();
            
            if (!prescription) {
                console.log('⚠️ Prescription not found in database:', prescriptionId);
                return getMockPrescriptionData(prescriptionId);
            }

            // Get doctor name
            const doctorFirstName = prescription.doctorId?.userId?.firstName || '';
            const doctorLastName = prescription.doctorId?.userId?.lastName || '';
            const doctorName = `${doctorFirstName} ${doctorLastName}`.trim() || 'your doctor';

            console.log(`✅ Fetched prescription data from database: ${prescription.diagnosis}`);

            return {
                _id: prescription._id,
                diagnosis: prescription.diagnosis || 'General consultation',
                doctorName: doctorName,
                medications: prescription.medications || [],
                additionalInstructions: prescription.additionalInstructions || '',
                followUpDate: prescription.followUpDate,
                nextVisitNeeded: prescription.nextVisitNeeded,
                nextVisitDate: prescription.nextVisitDate,
                status: prescription.status,
                createdAt: prescription.createdAt
            };
        }
    } catch (error) {
        console.error('❌ Error fetching prescription data from database:', error.message);
    }
    
    // Fallback to mock data
    console.log('ℹ️ Using mock prescription data for:', prescriptionId);
    return getMockPrescriptionData(prescriptionId);
}

// Mock data functions (fallback when database is not connected)
function getMockPatientData(patientId) {
    return {
        _id: patientId,
        firstName: 'John',
        lastName: 'Doe',
        phone: '919876543210', // Replace with actual patient phone for testing
        userId: {
            email: 'john.doe@example.com',
            phone: '919876543210'
        }
    };
}

function getMockPrescriptionData(prescriptionId) {
    return {
        _id: prescriptionId,
        diagnosis: 'Common Cold',
        doctorName: 'Smith',
        medications: [
            {
                name: 'Paracetamol',
                dosage: '500mg',
                frequency: 'Twice daily',
                duration: '5 days',
                instructions: 'Take after meals'
            },
            {
                name: 'Vitamin C',
                dosage: '1000mg',
                frequency: 'Once daily',
                duration: '7 days',
                instructions: 'Take with water'
            }
        ],
        additionalInstructions: 'Get plenty of rest and stay hydrated',
        followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    };
}

// Start Instagram bot
app.post('/start-instagram', upload.single('cookies'), (req, res) => {
    const { uniqueId, personality, users } = req.body;
    
    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'instagram');
    
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Write personality to file
    fs.writeFileSync(path.join(sessionDir, 'personality.txt'), personality || 'Default personality');
    
    // Copy uploaded cookies file
    if (req.file) {
        fs.copyFileSync(req.file.path, path.join(sessionDir, 'cookies.json'));
    } else {
        res.json({ success: false, message: 'No cookies file provided' });
        return;
    }
    
    // Parse and write users list
    let usersList = [];
    try {
        if (users && typeof users === 'string') {
            usersList = JSON.parse(users);
        } else if (Array.isArray(users)) {
            usersList = users;
        }
    } catch (e) {
        console.log('Error parsing users list:', e);
        usersList = [];
    }
    fs.writeFileSync(path.join(sessionDir, 'users.json'), JSON.stringify(usersList));
    
    // Copy bot files to session directory
    const originalInstaBot = path.join(__dirname, 'insta_bot.py');
    const sessionInstaBot = path.join(sessionDir, 'insta_bot.py');
    if (fs.existsSync(originalInstaBot)) {
        fs.copyFileSync(originalInstaBot, sessionInstaBot);
    }
    
    const originalSessionGemini = path.join(__dirname, 'session_gemini_bot.py');
    const sessionSessionGemini = path.join(sessionDir, 'session_gemini_bot.py');
    if (fs.existsSync(originalSessionGemini)) {
        fs.copyFileSync(originalSessionGemini, sessionSessionGemini);
    }
    
    // Check if bot is already running
    const botKey = `instagram_${uniqueId}`;
    if (activeBots.has(botKey)) {
        res.json({ success: false, message: 'Instagram bot is already running for this session' });
        return;
    }
    
    // Start Instagram bot process
    const botProcess = spawn('python', ['insta_bot.py'], {
        cwd: sessionDir,
        env: { 
            ...process.env, 
            SESSION_ID: uniqueId,
            SANITIZED_SESSION_ID: sanitizedId
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Log bot output
    const logFile = path.join(sessionDir, 'bot.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    botProcess.stdout.on('data', (data) => {
        logStream.write(data);
        const output = data.toString();
        if (output.includes('ERROR') || output.includes('started') || output.includes('stopped') || output.includes('Bot result:')) {
            console.log(`Instagram Bot ${uniqueId}:`, output.trim());
        }
    });
    
    botProcess.stderr.on('data', (data) => {
        logStream.write(data);
        const output = data.toString();
        if (output.includes('- INFO -') || output.includes('- WARNING -') || 
            output.includes('Successfully') || output.includes('Message sent:') || 
            output.includes('started') || output.includes('stopped') ||
            output.includes('Bot result:') || output.includes('Checking conversation') ||
            output.includes('Initial response sent') || output.includes('NEW INCOMING MESSAGE')) {
            console.log(`Instagram Bot ${uniqueId}:`, output.trim());
        } else if (output.includes('- ERROR -') || output.includes('- CRITICAL -') || 
                   output.includes('Exception') || output.includes('Traceback')) {
            console.error(`Instagram Bot ${uniqueId} Error:`, output.trim());
        }
    });
    
    botProcess.on('close', (code) => {
        console.log(`Instagram bot ${uniqueId} exited with code ${code}`);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    botProcess.on('error', (error) => {
        console.error(`Instagram bot ${uniqueId} spawn error:`, error);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    activeBots.set(botKey, botProcess);
    
    res.json({ success: true, message: 'Instagram bot started successfully' });
});

// Start LinkedIn bot
app.post('/start-linkedin', upload.none(), (req, res) => {
    const { uniqueId, personality, portfolioLink, testMode } = req.body;
    
    console.log(`LinkedIn bot start request for session: ${uniqueId}`);
    console.log(`Request body:`, { uniqueId, personality: personality?.length, portfolioLink, testMode });
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Session ID is required' });
    }
    
    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'linkedin');
    
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Write configuration files
    fs.writeFileSync(path.join(sessionDir, 'personality.txt'), personality || 'You are Nithin responding to LinkedIn messages. Be professional yet friendly, and authentic. Keep responses casual and under 30 words.');
    fs.writeFileSync(path.join(sessionDir, 'portfolio_link.txt'), portfolioLink || 'https://your-portfolio-link.com');
    fs.writeFileSync(path.join(sessionDir, 'test_mode.txt'), testMode ? 'true' : 'false');
    fs.writeFileSync(path.join(sessionDir, 'original_session_id.txt'), uniqueId);
    

    
    // Check if LinkedIn session exists
    const linkedinSessionFile = path.join(__dirname, 'linkedin_session.json');
    if (!fs.existsSync(linkedinSessionFile)) {
        return res.status(400).json({ 
            success: false, 
            message: 'LinkedIn session not found. Please create a session first using the "Create Session" button.',
            needsSession: true
        });
    }
    
    // Write business context
    const businessContext = `Services Offered:
- Custom Software Development
- Web & Mobile App Development  
- AI/ML Integration & Automation
- Cloud Solutions & DevOps
- MVP Development for Startups
- Full-stack Development Teams

Technologies:
React, Node.js, Python, AWS, Azure, MongoDB, PostgreSQL, Docker, Kubernetes

Business Focus:
Professional LinkedIn automation for lead generation and client communication. Specializing in software development services with AI-powered response generation.`;
    fs.writeFileSync(path.join(sessionDir, 'business_context.txt'), businessContext);
    
    // Copy bot files to session directory
    const originalBot = path.join(__dirname, 'scraper_v2.js');
    const sessionBot = path.join(sessionDir, 'scraper_v2.js');
    if (fs.existsSync(originalBot)) {
        fs.copyFileSync(originalBot, sessionBot);
    }
    
    // Copy session files if they exist - prioritize existing session files
    const originalSession = path.join(__dirname, 'linkedin_session.json');
    const sessionSessionFile = path.join(sessionDir, 'linkedin_session.json');
    
    // Only copy session if it doesn't already exist in the session directory
    if (fs.existsSync(originalSession) && !fs.existsSync(sessionSessionFile)) {
        fs.copyFileSync(originalSession, sessionSessionFile);
        console.log(`Copied LinkedIn session to: ${sessionSessionFile}`);
    } else if (fs.existsSync(sessionSessionFile)) {
        console.log(`Using existing LinkedIn session: ${sessionSessionFile}`);
    }
    
    const originalUserData = path.join(__dirname, 'linkedin_user_data');
    const sessionUserData = path.join(sessionDir, 'linkedin_user_data');
    
    // Only copy user data if it doesn't already exist in the session directory
    if (fs.existsSync(originalUserData) && !fs.existsSync(sessionUserData)) {
        // Copy entire user data directory
        const copyDir = (src, dest) => {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            const entries = fs.readdirSync(src, { withFileTypes: true });
            for (let entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);
                if (entry.isDirectory()) {
                    copyDir(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        };
        copyDir(originalUserData, sessionUserData);
        console.log(`Copied user data to: ${sessionUserData}`);
    } else if (fs.existsSync(sessionUserData)) {
        console.log(`Using existing user data: ${sessionUserData}`);
    }
    
    // Check if bot is already running
    const botKey = `linkedin_${uniqueId}`;
    if (activeBots.has(botKey)) {
        res.json({ success: false, message: 'LinkedIn bot is already running for this session' });
        return;
    }
    
    // Start LinkedIn bot process
    console.log(`Starting LinkedIn bot for session: ${uniqueId}`);
    console.log(`Session directory: ${sessionDir}`);
    console.log(`Test mode: ${testMode}, Portfolio: ${portfolioLink}`);
    
    const botProcess = spawn('node', ['scraper_v2.js'], {
        cwd: sessionDir,
        env: { 
            ...process.env, 
            SESSION_ID: uniqueId,
            SANITIZED_SESSION_ID: sanitizedId
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Log bot output
    const logFile = path.join(sessionDir, 'bot.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    botProcess.stdout.on('data', (data) => {
        logStream.write(data);
        console.log(`LinkedIn Bot ${uniqueId}:`, data.toString().trim());
    });
    
    botProcess.stderr.on('data', (data) => {
        logStream.write(data);
        console.error(`LinkedIn Bot ${uniqueId} Error:`, data.toString().trim());
    });
    
    botProcess.on('close', (code) => {
        console.log(`LinkedIn bot ${uniqueId} exited with code ${code}`);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    botProcess.on('error', (error) => {
        console.error(`LinkedIn bot ${uniqueId} spawn error:`, error);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    activeBots.set(botKey, botProcess);
    
    res.json({ 
        success: true, 
        message: 'LinkedIn bot started successfully',
        sessionDir: sanitizedId
    });
});

// Start Lead Generation
app.post('/start-leads', upload.none(), (req, res) => {
    const { uniqueId, keywords, location, maxLeads } = req.body;
    
    console.log(`Lead generation start request for session: ${uniqueId}`);
    console.log(`Request body:`, { uniqueId, keywords, location, maxLeads });
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Session ID is required' });
    }
    
    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId, 'leads');
    
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Write configuration files
    fs.writeFileSync(path.join(sessionDir, 'keywords.txt'), keywords || 'software development, web development, mobile app');
    fs.writeFileSync(path.join(sessionDir, 'location.txt'), location || 'San Francisco');
    fs.writeFileSync(path.join(sessionDir, 'max_leads.txt'), maxLeads || '50');
    fs.writeFileSync(path.join(sessionDir, 'original_session_id.txt'), uniqueId);
    
    // Check if LinkedIn session exists (needed for LinkedIn lead generation)
    const linkedinSessionFile = path.join(__dirname, 'linkedin_session.json');
    if (!fs.existsSync(linkedinSessionFile)) {
        console.log('Warning: LinkedIn session not found. Lead generation will work but LinkedIn search may be limited.');
    }
    
    // Copy lead generator to session directory
    const originalLeadGen = path.join(__dirname, 'lead_generator.js');
    const sessionLeadGen = path.join(sessionDir, 'lead_generator.js');
    if (fs.existsSync(originalLeadGen)) {
        fs.copyFileSync(originalLeadGen, sessionLeadGen);
    }
    
    // Copy package.json if it exists for dependencies
    const originalPackage = path.join(__dirname, 'package.json');
    const sessionPackage = path.join(sessionDir, 'package.json');
    if (fs.existsSync(originalPackage)) {
        fs.copyFileSync(originalPackage, sessionPackage);
    }
    
    // Check if lead generation is already running
    const botKey = `leads_${uniqueId}`;
    if (activeBots.has(botKey)) {
        res.json({ success: false, message: 'Lead generation is already running for this session' });
        return;
    }
    
    // Start lead generation process
    console.log(`Starting lead generation for session: ${uniqueId}`);
    console.log(`Session directory: ${sessionDir}`);
    console.log(`Keywords: ${keywords}, Location: ${location}, Max: ${maxLeads}`);
    
    const leadProcess = spawn('node', ['lead_generator.js', `--keywords=${keywords}`, `--location=${location}`, `--max=${maxLeads}`, '--out=leads_report.json'], {
        cwd: sessionDir,
        env: { 
            ...process.env, 
            SESSION_ID: uniqueId,
            SANITIZED_SESSION_ID: sanitizedId
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Log output
    const logFile = path.join(sessionDir, 'bot.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    leadProcess.stdout.on('data', (data) => {
        logStream.write(data);
        console.log(`Lead Gen ${uniqueId}:`, data.toString().trim());
    });
    
    leadProcess.stderr.on('data', (data) => {
        logStream.write(data);
        console.error(`Lead Gen ${uniqueId} Error:`, data.toString().trim());
    });
    
    leadProcess.on('close', (code) => {
        console.log(`Lead generation ${uniqueId} completed with code ${code}`);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    leadProcess.on('error', (error) => {
        console.error(`Lead generation ${uniqueId} spawn error:`, error);
        activeBots.delete(botKey);
        logStream.end();
    });
    
    activeBots.set(botKey, leadProcess);
    
    res.json({ 
        success: true, 
        message: 'Lead generation started successfully',
        sessionDir: sanitizedId
    });
});

// Get leads report for dashboard
app.get('/get-leads/:uniqueId', (req, res) => {
    const { uniqueId } = req.params;
    const sanitizedId = sanitizeSessionId(uniqueId);
    const leadsDir = path.join(__dirname, 'sessions', sanitizedId, 'leads');

    try {
        if (!fs.existsSync(leadsDir)) {
            return res.status(404).json({ success: false, message: 'No leads directory found' });
        }

        // Collect all json reports (timestamped and default)
        const files = fs.readdirSync(leadsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const fullPath = path.join(leadsDir, f);
                return {
                    name: f,
                    path: fullPath,
                    mtime: fs.statSync(fullPath).mtime
                };
            })
            .sort((a, b) => b.mtime - a.mtime);

        if (files.length === 0) {
            return res.status(404).json({ success: false, message: 'No leads reports found' });
        }

        const latest = files[0];
        const report = JSON.parse(fs.readFileSync(latest.path, 'utf8'));

        return res.json({
            success: true,
            report,
            fileName: latest.name,
            generatedAt: latest.mtime
        });
    } catch (error) {
        console.error('Error reading leads report:', error);
        return res.status(500).json({ success: false, message: 'Error reading leads report' });
    }
});

// Download latest leads report
app.get('/download-leads/:uniqueId', (req, res) => {
    const { uniqueId } = req.params;
    const sanitizedId = sanitizeSessionId(uniqueId);
    const leadsDir = path.join(__dirname, 'sessions', sanitizedId, 'leads');

    if (!fs.existsSync(leadsDir)) {
        return res.status(404).json({ success: false, message: 'No leads directory found' });
    }

    // Look for CSV files first, fallback to JSON
    const csvFiles = fs.readdirSync(leadsDir)
        .filter(f => f.endsWith('.csv'))
        .map(f => {
            const fullPath = path.join(leadsDir, f);
            return {
                name: f,
                path: fullPath,
                mtime: fs.statSync(fullPath).mtime,
                type: 'csv'
            };
        })
        .sort((a, b) => b.mtime - a.mtime);

    const jsonFiles = fs.readdirSync(leadsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            const fullPath = path.join(leadsDir, f);
            return {
                name: f,
                path: fullPath,
                mtime: fs.statSync(fullPath).mtime,
                type: 'json'
            };
        })
        .sort((a, b) => b.mtime - a.mtime);

    const allFiles = [...csvFiles, ...jsonFiles].sort((a, b) => b.mtime - a.mtime);

    if (allFiles.length === 0) {
        return res.status(404).json({ success: false, message: 'No leads report found' });
    }

    // Prefer CSV files over JSON
    const latest = csvFiles.length > 0 ? csvFiles[0] : jsonFiles[0];
    const fileExtension = latest.type;
    const fileName = `leads_report_${uniqueId}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
    
    console.log(`Downloading ${fileExtension.toUpperCase()} file: ${latest.path}`);
    return res.download(latest.path, fileName);
});

// Stop bot
app.post('/stop-bot', (req, res) => {
    const { uniqueId, botType } = req.body;
    const botKey = `${botType}_${uniqueId}`;
    
    if (activeBots.has(botKey)) {
        const botProcess = activeBots.get(botKey);
        
        // For Instagram bots, kill more forcefully
        if (botType === 'instagram') {
            try {
                if (process.platform === 'win32') {
                    require('child_process').exec(`taskkill /pid ${botProcess.pid} /T /F`, (error) => {
                        if (error) console.log(`Error killing Instagram bot: ${error}`);
                    });
                } else {
                    botProcess.kill('SIGKILL');
                }
            } catch (error) {
                console.log(`Error stopping Instagram bot: ${error}`);
            }
        } else {
            botProcess.kill();
        }
        
        activeBots.delete(botKey);
        console.log(`${botType} automation ${uniqueId} stopped`);
        res.json({ success: true, message: `${botType} automation stopped successfully` });
    } else {
        res.json({ success: false, message: 'Bot not found or already stopped' });
    }
});

// Get session status
app.get('/session-status/:uniqueId', (req, res) => {
    const { uniqueId } = req.params;
    
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Session ID is required' });
    }
    
    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId);
    
    if (!fs.existsSync(sessionDir)) {
        return res.json({ 
            exists: false, 
            message: 'Session directory not found' 
        });
    }
    
    // Check LinkedIn session files
    const linkedinSessionFile = path.join(__dirname, 'linkedin_session.json');
    const sessionLinkedinFile = path.join(sessionDir, 'linkedin', 'linkedin_session.json');
    const hasLinkedInSession = fs.existsSync(linkedinSessionFile) || fs.existsSync(sessionLinkedinFile);
    
    // Check user data
    const linkedinUserData = path.join(__dirname, 'linkedin_user_data');
    const sessionUserData = path.join(sessionDir, 'linkedin', 'linkedin_user_data');
    const hasUserData = fs.existsSync(linkedinUserData) || fs.existsSync(sessionUserData);
    
    // Check session age
    let sessionAge = null;
    if (hasLinkedInSession) {
        try {
            const sessionFile = fs.existsSync(linkedinSessionFile) ? linkedinSessionFile : sessionLinkedinFile;
            const stats = fs.statSync(sessionFile);
            sessionAge = new Date(stats.mtime).toLocaleString();
        } catch (err) {
            console.log('Error getting session age:', err.message);
        }
    }
    
    // Check running processes
    const processes = {
        sessionCreator: sessionCreators.has(`creator_${uniqueId}`),
        linkedinBot: activeBots.has(`linkedin_${uniqueId}`),
        leadGeneration: activeBots.has(`leads_${uniqueId}`)
    };
    
    res.json({
        exists: true,
        sessionDir: sanitizedId,
        hasLinkedInSession,
        hasUserData,
        sessionAge,
        processes
    });
});

// Get bot status
app.get('/bot-status/:uniqueId/:botType', (req, res) => {
    const { uniqueId, botType } = req.params;
    const botKey = `${botType}_${uniqueId}`;
    
    const isRunning = activeBots.has(botKey);
    
    const sanitizedId = sanitizeSessionId(uniqueId);
    const sessionDir = path.join(__dirname, 'sessions', sanitizedId, botType);
    
    let logs = '';
    try {
        const logFile = path.join(sessionDir, 'bot.log');
        if (fs.existsSync(logFile)) {
            logs = fs.readFileSync(logFile, 'utf8').split('\n').slice(-50).join('\n');
        }
    } catch (error) {
        logs = 'No logs available';
    }
    
    res.json({
        running: isRunning,
        logs: logs,
        sessionDir: sanitizedId
    });
});

// Dashboard-friendly recent message/events for a session
app.get('/message-dashboard/:uniqueId', (req, res) => {
    const { uniqueId } = req.params;
    if (!uniqueId) {
        return res.status(400).json({ success: false, message: 'Missing uniqueId' });
    }

    db.all(
        `SELECT id, session_id, event_type, contact, message, source, created_at
         FROM bot_events
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT 300`,
        [uniqueId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
            }

            const events = (rows || []).reverse();
            const summary = {
                total: events.length,
                sent: events.filter((e) => e.event_type === 'sent').length,
                received: events.filter((e) => e.event_type === 'received').length,
                bulkProcessing: events.filter((e) => e.event_type === 'bulk-processing').length
            };

            return res.json({ success: true, summary, events });
        }
    );
});

// Remove session
app.post('/remove-session', (req, res) => {
    const { uniqueId } = req.body;
    
    if (!uniqueId) {
        res.json({ success: false, message: 'No unique ID provided' });
        return;
    }
    
    try {
        // Stop any active bots for this session first
        const whatsappBotKey = `whatsapp_${uniqueId}`;
        const instagramBotKey = `instagram_${uniqueId}`;
        
        // Kill WhatsApp bot if running
        if (activeBots.has(whatsappBotKey)) {
            const botProcess = activeBots.get(whatsappBotKey);
            try {
                botProcess.kill('SIGTERM');
                setTimeout(() => {
                    if (activeBots.has(whatsappBotKey)) {
                        botProcess.kill('SIGKILL');
                    }
                }, 1000);
            } catch (e) {
                console.log('Error stopping WhatsApp bot:', e.message);
            }
            activeBots.delete(whatsappBotKey);
        }
        
        // Kill Instagram bot if running
        if (activeBots.has(instagramBotKey)) {
            const botProcess = activeBots.get(instagramBotKey);
            try {
                if (process.platform === 'win32') {
                    require('child_process').exec(`taskkill /pid ${botProcess.pid} /T /F`, (error) => {
                        if (error) console.log(`Error killing Instagram bot: ${error}`);
                    });
                } else {
                    botProcess.kill('SIGKILL');
                }
            } catch (e) {
                console.log('Error stopping Instagram bot:', e.message);
            }
            activeBots.delete(instagramBotKey);
        }
        
        // Wait for processes to terminate
        setTimeout(() => {
            // Remove from database
            db.run('DELETE FROM sessions WHERE id = ?', [uniqueId], function(err) {
                if (err) {
                    console.error('Database error:', err);
                    res.json({ success: false, message: 'Database error during removal' });
                    return;
                }
                
                // Mark session directory as deleted
                const sanitizedId = sanitizeSessionId(uniqueId);
                const sessionDir = path.join(__dirname, 'sessions', sanitizedId);
                const deletedSessionDir = path.join(__dirname, 'sessions', `${sanitizedId}_deleted_${Date.now()}`);
                
                if (fs.existsSync(sessionDir)) {
                    try {
                        setTimeout(() => {
                            try {
                                fs.renameSync(sessionDir, deletedSessionDir);
                                console.log(`Session ${uniqueId} marked as deleted`);
                            } catch (renameError) {
                                // Alternative: create a .deleted marker file
                                try {
                                    fs.writeFileSync(path.join(sessionDir, '.deleted'), new Date().toISOString());
                                    console.log(`Session ${uniqueId} marked as deleted with marker file`);
                                } catch (markerError) {
                                    console.error('Could not create deletion marker:', markerError.message);
                                }
                            }
                        }, 500);
                    } catch (error) {
                        console.error('Error accessing session directory:', error.message);
                    }
                }
                
                res.json({ 
                    success: true, 
                    message: 'Session removed successfully. Redirecting to login...' 
                });
            });
        }, 2000);
        
    } catch (error) {
        console.error('Error removing session:', error);
        res.json({ success: false, message: 'Error removing session' });
    }
});

// Start server
function startServer() {
    try {
        app.listen(PORT, HOST, () => {
            console.log(`🚀 WOAT Bot Control Server running on http://localhost:${PORT}`);
            console.log(`🌐 Server accessible at http://${HOST}:${PORT}`);
            console.log('📱 Access the interface in your web browser');
            console.log('🔧 CORS enabled for all origins');
            console.log('🔍 Health check available at: /health');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    
    // Gracefully stop all active bots
    activeBots.forEach((botProcess, botKey) => {
        try {
            console.log(`Stopping bot: ${botKey}`);
            if (botKey.includes('instagram')) {
                if (process.platform === 'win32') {
                    require('child_process').exec(`taskkill /pid ${botProcess.pid} /T /F`);
                } else {
                    botProcess.kill('SIGKILL');
                }
            } else {
                botProcess.kill('SIGTERM');
            }
        } catch (e) {
            console.log(`Error stopping bot ${botKey}:`, e.message);
        }
    });
    
    activeBots.clear();
    
    // Close database
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    process.emit('SIGINT');
});
