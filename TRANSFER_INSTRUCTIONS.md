# 📦 Taxia Desktop - Transfer & Setup Instructions

## 📊 Build Summary

✅ **Mac Package:** `out/make/zip/darwin/arm64/taxia-desktop-darwin-arm64-1.0.0.zip` (133 MB)
✅ **Windows Package:** `out/taxia-desktop-win32-x64.zip` (147 MB)

---

## 🖥️ Mac Setup (Server Mode)

### Option 1: Test Packaged App
```bash
cd out/make/zip/darwin/arm64
unzip taxia-desktop-darwin-arm64-1.0.0.zip
open "Taxia Desktop.app"
```

### Option 2: Keep Dev Server Running
```bash
npm start  # Already running on http://172.30.1.17:3000
```

**Your Mac Server IP:** `172.30.1.17:3000`

---

## 💻 Galaxy Book Setup (Client Mode)

### Step 1: Transfer Windows ZIP

**Choose one method:**

#### A. Google Drive
1. Upload `out/taxia-desktop-win32-x64.zip` to Google Drive
2. Download on Galaxy Book

#### B. USB Drive
1. Copy `out/taxia-desktop-win32-x64.zip` to USB
2. Plug into Galaxy Book

#### C. Create Transfer Script
```bash
# Run this on Mac to copy to USB or network share
./create-transfer-package.sh
```

### Step 2: Extract on Galaxy Book

1. Extract `taxia-desktop-win32-x64.zip` to Desktop
2. You'll see folder: `taxia-desktop-win32-x64/`
3. Inside: `taxia-desktop.exe`

### Step 3: Configure Client Mode

**Create config file:**
- Location: `C:\Users\<YourName>\AppData\Roaming\Electron\config.json`
- Content:
```json
{
  "app_mode": "client",
  "server_url": "http://172.30.1.17:3000",
  "initialized": true
}
```

**Quick config (PowerShell):**
```powershell
$configDir = "$env:APPDATA\Electron"
New-Item -ItemType Directory -Force -Path $configDir
@"
{
  "app_mode": "client",
  "server_url": "http://172.30.1.17:3000",
  "initialized": true
}
"@ | Out-File -FilePath "$configDir\config.json" -Encoding UTF8
```

### Step 4: Run Client

1. Double-click `taxia-desktop.exe`
2. App should connect to Mac server!
3. Login with Mac credentials:
   - Email: `jungeol66104@gmail.com`
   - Password: (your password)

---

## ✅ Verification Checklist

### On Mac (Server):
- [ ] Server running on `http://172.30.1.17:3000`
- [ ] Database accessible
- [ ] Can create clients/tasks

### On Galaxy Book (Client):
- [ ] App launches without errors
- [ ] Can see login screen
- [ ] Can login with server credentials
- [ ] Can see same clients/tasks as server
- [ ] Can create/edit data (syncs to server)

### Network Test:
```bash
# On Galaxy Book, test connectivity:
curl http://172.30.1.17:3000
# Should return: {"status":"healthy",...}
```

---

## 🔧 Troubleshooting

### Client Can't Connect

**Check 1: Network**
```bash
ping 172.30.1.17
```

**Check 2: Firewall on Mac**
- System Preferences → Security & Privacy → Firewall
- Allow connections for Taxia Desktop

**Check 3: Same WiFi Network**
- Mac and Galaxy Book must be on same network

### Config Not Found

Config file location:
- **Windows:** `%APPDATA%\Electron\config.json`
- **Mac:** `~/Library/Application Support/Electron/config.json`

Create manually if needed!

---

## 📱 Next Steps

Once client-server works:
1. Test CRUD operations (create clients, tasks)
2. Test Google Drive integration (Mac server only)
3. Test multi-user access
4. Package for distribution

---

## 🎉 Success Criteria

✅ Mac runs as server
✅ Galaxy Book connects as client
✅ Both see same data
✅ Changes sync between devices
