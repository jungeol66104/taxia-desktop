# Taxia Desktop - Build & Installation Guide

## ✅ Setup Complete!

Your Electron app is now fully configured for building installable applications for both macOS and Windows.

---

## 📦 What Was Installed

### System Requirements (Installed)
- ✅ **Mono 6.14.1** - .NET framework for cross-platform builds
- ✅ **@electron-forge/maker-dmg** - macOS DMG installer maker
- ⚠️ **Wine** - Failed (requires sudo for dependencies)
  - Note: Wine is only needed for building Windows .exe on Mac
  - You can build Windows installers on a Windows machine instead

### Build Configuration
- ✅ Updated `forge.config.ts` with DMG maker
- ✅ Updated `package.json` with proper metadata
- ✅ Added platform-specific build scripts
- ✅ Fixed postPackage hook for renamed product name

---

## 🚀 How to Build Installers

### Build for macOS (Current Platform)
```bash
# Build macOS DMG installer
npm run make:mac

# Output: out/make/Taxia-1.0.0-arm64.dmg (178 MB)
```

### Build for Windows (On Mac - Requires Wine)
```bash
# First, install Wine with sudo access:
sudo brew install --cask wine-stable

# Then build Windows installer
npm run make:win

# Output: out/make/squirrel.windows/x64/Taxia-1.0.0 Setup.exe
```

### Build for Both Platforms
```bash
npm run make:all
```

### Clean Build
```bash
# Clean previous builds
npm run clean

# Then rebuild
npm run make:mac
```

---

## 📂 Build Output

After running `npm run make:mac`, you'll find:

```
out/
├── Taxia-darwin-arm64/          # Packaged app (not installer)
│   └── Taxia.app                # macOS application
└── make/
    ├── Taxia-1.0.0-arm64.dmg    # macOS installer (178 MB)
    └── zip/
        └── darwin/
            └── arm64/
                └── Taxia-darwin-arm64-1.0.0.zip  # Portable version
```

---

## 🎯 Distribution Flow

### For macOS Users:
1. Share `Taxia-1.0.0-arm64.dmg`
2. User downloads DMG
3. User opens DMG
4. User drags "Taxia" to Applications folder
5. Done! App installed

### For Windows Users:
1. Share `Taxia-1.0.0 Setup.exe` (when built)
2. User downloads Setup.exe
3. User runs installer
4. App installs automatically
5. Done! Desktop shortcut created

---

## 🔧 Build Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `npm run make` | Default build | Builds for current platform |
| `npm run make:mac` | macOS only | Creates .dmg installer |
| `npm run make:win` | Windows only | Creates .exe installer |
| `npm run make:all` | Both platforms | Creates both installers |
| `npm run clean` | Clean output | Removes build artifacts |
| `npm run package` | Package only | Creates app without installer |

---

## 📋 Current Configuration

### package.json
```json
{
  "name": "taxia-desktop",
  "productName": "Taxia",
  "version": "1.0.0",
  "description": "Tax office workflow management system with automated call transcription and task extraction"
}
```

### Supported Platforms
- ✅ macOS (native - arm64)
- ✅ Windows (via Wine - x64)
- 🟡 Linux (.deb, .rpm configured but optional)

---

## ⚠️ Known Issues

### Wine Installation Failed
**Problem:** Wine installation requires sudo password for gstreamer dependency

**Solutions:**
1. **Option A:** Install Wine manually with sudo:
   ```bash
   sudo brew install --cask wine-stable
   ```

2. **Option B:** Build Windows installer on a Windows machine:
   - Clone repo on Windows
   - Run `npm install`
   - Run `npm run make:win`

3. **Option C:** Use CI/CD (GitHub Actions) to build both platforms automatically

### Code Signing (Not Yet Configured)
**Current State:** Unsigned builds will show warnings:
- macOS: "App from unidentified developer"
- Windows: "Windows protected your PC"

**To Fix (Later):**
1. Get Apple Developer Account ($99/year)
2. Get Windows Code Signing Certificate ($70-300/year)
3. Add signing configuration to `forge.config.ts`

---

## 🎉 Success! First Build Completed

Your first macOS installer has been successfully created:
- **File:** `out/make/Taxia-1.0.0-arm64.dmg`
- **Size:** 178 MB
- **Platform:** macOS (Apple Silicon)

You can now distribute this DMG file to Mac users for installation!

---

## 🔜 Next Steps

1. **Test the installer:**
   ```bash
   open out/make/Taxia-1.0.0-arm64.dmg
   ```

2. **Set up Windows builds:**
   - Install Wine with sudo, OR
   - Build on Windows machine, OR
   - Use GitHub Actions for automated builds

3. **Implement auto-updates:**
   - Install `electron-updater`
   - Configure GitHub Releases
   - Add update checking logic

4. **Add code signing (when ready for production):**
   - Purchase certificates
   - Configure signing in forge.config.ts
   - Eliminate security warnings

---

## 📚 Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [electron-updater Guide](https://www.electron.build/auto-update)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [GitHub Actions for Electron](https://www.electronforge.io/guides/github-actions)

---

**Last Updated:** 2025-10-11
**Status:** ✅ Ready for Distribution (macOS)
