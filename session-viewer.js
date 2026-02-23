const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

class WhatsAppSessionViewer {
    constructor(sessionPath = "C:\\Users\\nithi\\Downloads\\whatsapp_session") {
        this.sessionPath = sessionPath;
        this.client = null;
    }

    // Check if session exists
    sessionExists() {
        return fs.existsSync(this.sessionPath) && 
               fs.readdirSync(this.sessionPath).length > 0;
    }

    // Validate session integrity
    isSessionValid() {
        if (!this.sessionExists()) return false;
        
        try {
            // Check for essential session files in the main session directory
            const sessionDir = path.join(this.sessionPath, 'session');
            if (!fs.existsSync(sessionDir)) {
                console.log('Session subdirectory not found');
                return false;
            }
            
            // Check if session directory has required structure
            const requiredPaths = ['Default'];
            const hasRequired = requiredPaths.some(p => 
                fs.existsSync(path.join(sessionDir, p))
            );
            
            if (!hasRequired) {
                console.log('Required session files not found');
                return false;
            }
            
            return true;
        } catch (error) {
            console.log('Session validation error:', error.message);
            return false;
        }
    }

    // List session files
    listSessionFiles() {
        if (!this.sessionExists()) {
            console.log('❌ No session found');
            return [];
        }

        console.log('📁 Session files found:');
        const files = fs.readdirSync(this.sessionPath, { withFileTypes: true });
        
        files.forEach(file => {
            const type = file.isDirectory() ? '📁' : '📄';
            const size = file.isFile() ? 
                `(${(fs.statSync(path.join(this.sessionPath, file.name)).size / 1024).toFixed(1)}KB)` : '';
            console.log(`   ${type} ${file.name} ${size}`);
        });

        return files.map(f => f.name);
    }

    // Get session info
    getSessionInfo() {
        if (!this.sessionExists()) {
            return null;
        }

        const sessionFiles = this.listSessionFiles();
        const sessionSize = this.calculateSessionSize();
        
        return {
            path: this.sessionPath,
            files: sessionFiles,
            totalSize: sessionSize,
            lastModified: this.getLastModifiedDate()
        };
    }

    // Calculate session folder size
    calculateSessionSize() {
        if (!this.sessionExists()) return 0;

        let totalSize = 0;
        const files = fs.readdirSync(this.sessionPath, { withFileTypes: true });
        
        files.forEach(file => {
            const filePath = path.join(this.sessionPath, file.name);
            if (file.isFile()) {
                totalSize += fs.statSync(filePath).size;
            } else if (file.isDirectory()) {
                // Recursively calculate directory size
                totalSize += this.calculateDirectorySize(filePath);
            }
        });

        return totalSize;
    }

    calculateDirectorySize(dirPath) {
        let size = 0;
        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            files.forEach(file => {
                const filePath = path.join(dirPath, file.name);
                if (file.isFile()) {
                    size += fs.statSync(filePath).size;
                } else if (file.isDirectory()) {
                    size += this.calculateDirectorySize(filePath);
                }
            });
        } catch (error) {
            console.log(`Error reading directory ${dirPath}:`, error.message);
        }
        return size;
    }

    // Get last modified date
    getLastModifiedDate() {
        if (!this.sessionExists()) return null;

        const stats = fs.statSync(this.sessionPath);
        return stats.mtime;
    }

    // Create WhatsApp client with existing session
    async openSession(headless = false, retries = 3) {
        console.log('🔄 Initializing WhatsApp with existing session...');
        
        // Validate session before attempting to open
        if (!this.isSessionValid()) {
            console.log('⚠️  Session appears to be corrupted or incomplete');
            console.log('💡 Try clearing the session with: node session-viewer.js clear');
            return false;
        }
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`🔄 Attempt ${attempt}/${retries}...`);
                
                // Clean up any existing client
                if (this.client) {
                    try {
                        await this.client.destroy();
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                    this.client = null;
                }
                
                this.client = new Client({
                    authStrategy: new LocalAuth({
                        dataPath: this.sessionPath
                    }),
                    puppeteer: {
                        headless: headless,
                        timeout: 60000,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-accelerated-2d-canvas',
                            '--no-first-run',
                            '--no-zygote',
                            '--disable-gpu'
                        ]
                    },
                });

                this.setupEventHandlers();
                
                // Set a timeout for initialization
                const initPromise = this.client.initialize();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Initialization timeout')), 90000)
                );
                
                await Promise.race([initPromise, timeoutPromise]);
                console.log('✅ Session opened successfully!');
                return true;
                
            } catch (error) {
                console.error(`❌ Attempt ${attempt} failed:`, error.message);
                
                if (attempt === retries) {
                    console.error('❌ All attempts failed. Session may be corrupted.');
                    console.log('💡 Solutions:');
                    console.log('   1. Clear session: node session-viewer.js clear');
                    console.log('   2. Try with GUI: node session-viewer.js open --gui');
                    console.log('   3. Check if WhatsApp Web is logged in elsewhere');
                    return false;
                }
                
                // Wait before retry
                console.log(`⏳ Waiting 5 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        return false;
    }

    // Setup event handlers
    setupEventHandlers() {
        this.client.on('loading_screen', (percent, message) => {
            console.log(`🔄 Loading... ${percent}% - ${message}`);
        });
        
        this.client.on('qr', (qr) => {
            console.log('📱 New QR Code needed (session may be expired):');
            qrcode.generate(qr, { small: true });
            console.log('Scan this QR code with your WhatsApp mobile app');
        });

        this.client.on('authenticated', () => {
            console.log('✅ Authentication successful!');
        });

        this.client.on('ready', async () => {
            console.log('✅ WhatsApp Web is ready!');
            try {
                await this.displayAccountInfo();
            } catch (error) {
                console.error('Error displaying account info:', error.message);
            }
        });

        this.client.on('auth_failure', (msg) => {
            console.error('❌ Authentication failed:', msg);
            console.log('💡 This usually means the session is corrupted or expired.');
            console.log('   Try: node session-viewer.js clear');
        });

        this.client.on('disconnected', (reason) => {
            console.log('🔌 WhatsApp disconnected:', reason);
            if (reason === 'NAVIGATION') {
                console.log('💡 This is usually normal - WhatsApp navigated to a new page');
            }
        });
        
        // Add error handler for unhandled errors
        this.client.on('error', (error) => {
            console.error('❌ Client error:', error.message);
        });
    }

    // Display account information
    async displayAccountInfo() {
        try {
            const info = this.client.info;
            console.log('\n📱 Account Information:');
            console.log(`   Name: ${info.pushname || 'Not set'}`);
            console.log(`   Number: ${info.wid.user}`);
            console.log(`   Platform: ${info.platform}`);
            
            // Get recent chats
            const chats = await this.client.getChats();
            console.log(`\n💬 Total Chats: ${chats.length}`);
            
            // Show recent chats
            console.log('\n📋 Recent Chats:');
            const recentChats = chats.slice(0, 10);
            for (const chat of recentChats) {
                const type = chat.isGroup ? '👥' : '👤';
                const unread = chat.unreadCount > 0 ? `(${chat.unreadCount} unread)` : '';
                console.log(`   ${type} ${chat.name} ${unread}`);
            }
            
        } catch (error) {
            console.error('Error getting account info:', error);
        }
    }

    // Backup session
    backupSession(backupPath) {
        if (!this.sessionExists()) {
            console.log('❌ No session to backup');
            return false;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = backupPath || `./session_backup_${timestamp}`;
            
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            this.copyDirectory(this.sessionPath, backupDir);
            console.log(`✅ Session backed up to: ${backupDir}`);
            return backupDir;
        } catch (error) {
            console.error('❌ Backup failed:', error);
            return false;
        }
    }

    // Copy directory recursively
    copyDirectory(src, dest) {
        const items = fs.readdirSync(src, { withFileTypes: true });
        
        items.forEach(item => {
            const srcPath = path.join(src, item.name);
            const destPath = path.join(dest, item.name);
            
            if (item.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }

    // Restore session from backup
    restoreSession(backupPath) {
        if (!fs.existsSync(backupPath)) {
            console.log('❌ Backup path not found');
            return false;
        }

        try {
            // Remove existing session
            if (this.sessionExists()) {
                fs.rmSync(this.sessionPath, { recursive: true, force: true });
            }

            // Create session directory
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
            }

            // Copy backup to session
            this.copyDirectory(backupPath, this.sessionPath);
            console.log('✅ Session restored successfully');
            return true;
        } catch (error) {
            console.error('❌ Restore failed:', error);
            return false;
        }
    }

    // Clear session
    clearSession() {
        if (!this.sessionExists()) {
            console.log('❌ No session to clear');
            return;
        }

        try {
            fs.rmSync(this.sessionPath, { recursive: true, force: true });
            console.log('✅ Session cleared successfully');
        } catch (error) {
            console.error('❌ Failed to clear session:', error);
        }
    }

    // Close client
    async close() {
        if (this.client) {
            await this.client.destroy();
            console.log('✅ WhatsApp client closed');
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const viewer = new WhatsAppSessionViewer();
    
    switch (command) {
        case 'info':
            console.log('📊 Session Information:');
            const info = viewer.getSessionInfo();
            if (info) {
                console.log(`   Path: ${info.path}`);
                console.log(`   Files: ${info.files.length}`);
                console.log(`   Size: ${(info.totalSize / 1024 / 1024).toFixed(2)} MB`);
                console.log(`   Last Modified: ${info.lastModified}`);
            } else {
                console.log('   No session found');
            }
            break;
            
        case 'list':
            viewer.listSessionFiles();
            break;
            
        case 'open':
            const headless = !args.includes('--gui');
            console.log(`Opening WhatsApp session (headless: ${headless})`);
            await viewer.openSession(headless);
            break;
            
        case 'backup':
            const backupPath = args[1];
            viewer.backupSession(backupPath);
            break;
            
        case 'restore':
            const restorePath = args[1];
            if (!restorePath) {
                console.log('❌ Please provide backup path');
                break;
            }
            viewer.restoreSession(restorePath);
            break;
            
        case 'clear':
            console.log('⚠️  This will delete your WhatsApp session!');
            console.log('You will need to scan QR code again.');
            
            // Auto-backup before clearing
            const backupCreated = viewer.backupSession();
            if (backupCreated) {
                console.log('✅ Session backed up before clearing.');
            }
            
            viewer.clearSession();
            console.log('💡 To restore: node session-viewer.js restore ' + backupCreated);
            break;
            
        default:
            console.log('📱 WhatsApp Session Manager');
            console.log('');
            console.log('Commands:');
            console.log('  info     - Show session information');
            console.log('  list     - List session files');
            console.log('  open     - Open WhatsApp with current session');
            console.log('  open --gui - Open with visible browser');
            console.log('  backup [path] - Backup current session');
            console.log('  restore <path> - Restore session from backup');
            console.log('  clear    - Clear current session');
            console.log('');
            console.log('Examples:');
            console.log('  node session-viewer.js info');
            console.log('  node session-viewer.js open');
            console.log('  node session-viewer.js backup ./my-backup');
            console.log('  node session-viewer.js restore ./my-backup');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
});

if (require.main === module) {
    main().catch(console.error);
}

module.exports = WhatsAppSessionViewer;
