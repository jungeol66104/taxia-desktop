# Galaxy Book (Windows) Setup Guide

This guide will help you set up Taxia Desktop on your Galaxy Book as a **client** that connects to your Mac server.

## Prerequisites

1. **Node.js** (v18 or higher): Download from https://nodejs.org/
2. **Git**: Download from https://git-scm.com/
3. **Mac server IP address**: You'll need the local network URL from your Mac (shown in Settings tab when running in server mode)

## Step 1: Transfer Project Files

### Option A: Clone from Git (if you've pushed to a repository)
```bash
git clone <your-repo-url>
cd taxia-desktop
```

### Option B: Transfer files directly
1. On Mac, create a zip of the project:
   ```bash
   cd /Users/joonnam/Workspace/taxia-desktop
   # Exclude node_modules and build artifacts
   zip -r taxia-desktop.zip . -x "node_modules/*" ".vite/*" "out/*" "dist/*" "prisma/taxia.db*"
   ```

2. Transfer `taxia-desktop.zip` to Galaxy Book (via USB, network share, or cloud)

3. On Galaxy Book, extract the zip:
   ```bash
   # Extract to your desired location
   unzip taxia-desktop.zip -d C:\Users\YourUsername\taxia-desktop
   cd C:\Users\YourUsername\taxia-desktop
   ```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including Electron, React, Prisma, etc.

## Step 3: Build Prisma Client

```bash
npx prisma generate
```

This generates the Prisma client for Windows.

## Step 4: Run the App

```bash
npm run dev
```

The app will start and show the setup wizard on first run.

## Step 5: Configure as Client

1. When the setup wizard appears, select **"Client Mode"**

2. Enter the server URL from your Mac:
   - Example: `http://172.30.1.10:3000`
   - You can find this in the Mac app's Settings tab under "Server URL"

3. Click **"Complete Setup"**

4. You'll be taken to the login screen

5. Log in with your existing credentials:
   - Email: `jungeol66104@gmail.com`
   - Password: `test123`

## Step 6: Verify Connection

After logging in:
1. Go to the **Clients tab** - you should see all your clients from the server
2. Go to the **Tasks tab** - you should see all your tasks from the server
3. Create a new client or task - it should appear on both Mac and Galaxy Book

## Troubleshooting

### Cannot connect to server
- Ensure both devices are on the same Wi-Fi network
- Check that the server URL is correct
- Verify the Mac server is running (check Settings tab on Mac)
- Try pinging the server from Galaxy Book:
  ```bash
  ping 172.30.1.10
  ```

### Build errors
- Make sure you have the correct Node.js version: `node --version` (should be v18+)
- Delete `node_modules` and run `npm install` again
- Delete `.vite` folder and try again

### Prisma errors
- Run `npx prisma generate` to regenerate the Prisma client
- Make sure the Prisma schema is in sync

## Building a Distributable Package (Optional)

If you want to create a standalone installer for Windows:

```bash
npm run make
```

This will create:
- **Squirrel installer** (`.exe`): `out/make/squirrel.windows/`
- **Portable ZIP**: `out/make/zip/win32/`

The portable ZIP can be extracted and run without installation.

## Network Configuration

### Firewall Settings (Mac)
Make sure the Mac firewall allows incoming connections on port 3000:
1. System Settings → Network → Firewall
2. Add exception for the Taxia Desktop app or port 3000

### Firewall Settings (Windows)
If connection fails, you may need to allow the app through Windows Firewall:
1. Windows Security → Firewall & network protection
2. Allow an app through firewall
3. Add Electron app

## Using Both Devices

- **Mac (Server)**: Has the database, processes Google Drive files, runs AI tasks
- **Galaxy Book (Client)**: Connects to Mac server, full UI functionality
- **Data sync**: All data operations on Galaxy Book are sent to Mac server
- **Offline**: Galaxy Book requires Mac server to be running and accessible

## Switching Modes

You can switch between Server and Client modes in Settings:
1. Go to Settings tab
2. Under "App Mode", toggle between Server/Client
3. Restart the app

Note: Only switch to Server mode if you want this device to have its own database.
