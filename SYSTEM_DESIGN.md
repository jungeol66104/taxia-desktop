# Taxia Desktop - Complete System Design & Architecture

**Last Updated:** 2025-10-04
**Version:** 1.0.0 MVP
**Target:** Tax accounting office with ~5 staff members

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Data Flow](#3-data-flow)
4. [User Flows](#4-user-flows)
5. [Technical Stack](#5-technical-stack)
6. [Database Schema](#6-database-schema)
7. [API Design](#7-api-design)
8. [File Structure](#8-file-structure)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Deployment Guide](#10-deployment-guide)
11. [Key Decisions](#11-key-decisions)

---

## 1. System Overview

### Business Context

- **Target:** Tax accounting office with ~5 staff members
- **Use Case:** Automated call transcription → task extraction → team collaboration
- **Deployment:** 1 server PC + 4 client PCs on local network (LAN)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tax Office Network                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  SERVER PC (192.168.1.100)                                │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Taxia Desktop (Server Mode)                        │  │ │
│  │  │                                                      │  │ │
│  │  │  Main Process (Electron)                            │  │ │
│  │  │  ├─ SettingsService (electron-store)                │  │ │
│  │  │  ├─ DatabaseService (SQLite + Prisma)               │  │ │
│  │  │  ├─ GoogleDriveService (Watch folder)               │  │ │
│  │  │  ├─ OpenAIService (STT + Task extraction)           │  │ │
│  │  │  ├─ WebhookService (Receive Drive notifications)    │  │ │
│  │  │  ├─ HTTPAPIService (Express REST API)               │  │ │
│  │  │  └─ LocalDataAccess (Direct DB access)              │  │ │
│  │  │                                                      │  │ │
│  │  │  Renderer Process (React)                           │  │ │
│  │  │  └─ Same UI as client (admin can use it)            │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  Storage:                                                  │ │
│  │  ├─ ~/taxia-data/taxia.db (SQLite)                        │ │
│  │  │  └─ Users, Clients, Tasks, Calls, Messages, etc.       │ │
│  │  ├─ ~/taxia-data/recordings/ (Audio files)                │ │
│  │  └─ ~/.config/taxia/config.json (Local settings)          │ │
│  │     ├─ app_mode: "server"                                 │ │
│  │     ├─ server_port: 3000                                  │ │
│  │     └─ google_drive_folder_id: "xxx"                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│                    Network: HTTP REST API                       │
│                    Port: 3000                                   │
│                           │                                     │
│        ┌──────────────────┼──────────────────┐                 │
│        │                  │                  │                 │
│  ┌─────▼────┐      ┌──────▼───┐      ┌──────▼───┐             │
│  │ Client 1 │      │ Client 2 │      │ Client 3 │             │
│  │          │      │          │      │          │             │
│  │ Staff 1  │      │ Staff 2  │      │ Staff 3  │             │
│  │          │      │          │      │          │             │
│  │ Taxia    │      │ Taxia    │      │ Taxia    │             │
│  │ Desktop  │      │ Desktop  │      │ Desktop  │             │
│  │          │      │          │      │          │             │
│  │ Main:    │      │ Main:    │      │ Main:    │             │
│  │ └─Remote │      │ └─Remote │      │ └─Remote │             │
│  │   Data   │      │   Data   │      │   Data   │             │
│  │   Access │      │   Access │      │   Access │             │
│  │          │      │          │      │          │             │
│  │ Config:  │      │ Config:  │      │ Config:  │             │
│  │ app_mode │      │ app_mode │      │ app_mode │             │
│  │ server_  │      │ server_  │      │ server_  │             │
│  │   url    │      │   url    │      │   url    │             │
│  └──────────┘      └──────────┘      └──────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                External Services
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐  ┌────▼─────┐  ┌────▼──────┐
    │ Google Drive │  │ OpenAI   │  │ LocalTunnel│
    │              │  │ Whisper  │  │ (Webhook)  │
    │ Call         │  │ GPT-4    │  │            │
    │ Recordings   │  │          │  │            │
    └──────────────┘  └──────────┘  └────────────┘
```

---

## 2. Architecture

### Server Mode Components

```typescript
Main Process (Node.js + Electron)
├─ SettingsService        // electron-store (local config)
├─ DatabaseService        // SQLite + Prisma (business data)
├─ LocalDataAccess        // Direct DB access (fast)
├─ HTTPAPIService         // Express REST API (for clients)
├─ GoogleDriveService     // Watch folder, download files
├─ OpenAIService          // Whisper STT + GPT-4 extraction
├─ WebhookService         // Receive Google Drive push notifications
└─ FileDetectionService   // Process incoming recordings

Renderer Process (React)
└─ Same UI as clients (admin workspace)
```

### Client Mode Components

```typescript
Main Process (Node.js + Electron)
├─ SettingsService        // electron-store (local config)
└─ RemoteDataAccess       // HTTP API calls to server

Renderer Process (React)
└─ Full UI (tasks, calls, clients, settings)
```

### Data Access Abstraction Layer

```typescript
// Interface (same for both)
interface DataAccessService {
  getAllClients(): Promise<Client[]>;
  createClient(data): Promise<Client>;
  getAllTasks(): Promise<Task[]>;
  createTask(data): Promise<Task>;
  // ... etc
}

// Server implementation
class LocalDataAccess implements DataAccessService {
  constructor(private db: DatabaseService) {}

  async getAllClients() {
    return this.db.getAllClients(); // Direct DB query
  }
}

// Client implementation
class RemoteDataAccess implements DataAccessService {
  constructor(private serverUrl: string, private token: string) {}

  async getAllClients() {
    const res = await fetch(`${this.serverUrl}/api/clients`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return res.json();
  }
}

// Usage (same for both!)
const dataAccess: DataAccessService = appMode === 'server'
  ? new LocalDataAccess(databaseService)
  : new RemoteDataAccess(serverUrl, token);

// Anywhere in the app
const clients = await dataAccess.getAllClients();
```

---

## 3. Data Flow

### Call Processing Flow (Server Only)

```
1. Google Drive
   └─ New file uploaded: recording.wav
       ↓
2. Google Drive Webhook
   └─ POST to LocalTunnel → Server webhook endpoint
       ↓
3. FileDetectionService
   ├─ Download file to ~/taxia-data/recordings/
   ├─ Extract audio duration
   └─ Create Call record in DB
       ↓
4. Background Processing
   ├─ OpenAI Whisper STT
   │  └─ Update Call.transcript
   ├─ OpenAI GPT-4 Task Extraction
   │  └─ Extract candidate tasks
   └─ Create Message with tasks
       ↓
5. All clients poll periodically (10 sec)
   └─ GET /api/calls
   └─ Update UI if new data
```

### User Action Flow (Client → Server)

```
Client PC (Staff clicks "Create Task")
    ↓
Renderer Process
    └─ User fills form
        ↓
IPC to Main Process
    └─ electronAPI.createTask(taskData)
        ↓
Main Process (Client Mode)
    └─ RemoteDataAccess
        ↓
HTTP POST to Server
    └─ POST http://192.168.1.100:3000/api/tasks
        Headers: Authorization: Bearer <JWT>
        Body: { title, clientId, assignee, ... }
            ↓
Server HTTP API
    └─ Authenticate JWT
    └─ Validate request
        ↓
DatabaseService (Server)
    └─ INSERT INTO Task
        ↓
Response to Client
    └─ Return created task
        ↓
Client Updates UI
    └─ Add task to list
```

---

## 4. User Flows

### Flow 1: Initial Setup - Server

```
1. Download Taxia-Setup.exe
2. Run installer
3. First launch
   ↓
┌─────────────────────────────────┐
│  Is this server or client?     │
│  [🖥️ Server] [💻 Client]       │
└─────────────────────────────────┘
   ↓ Click "Server"
┌─────────────────────────────────┐
│  Office Information (1/4)      │
│  Office name: [__________]     │
│  Representative: [__________]  │
│  [Next →]                       │
└─────────────────────────────────┘
   ↓
┌─────────────────────────────────┐
│  Admin Account (2/4)           │
│  Name: [__________]            │
│  Email: [__________]           │
│  Password: [__________]        │
│  ✓ 8+ chars, uppercase, etc.   │
│  [Next →]                       │
└─────────────────────────────────┘
   ↓
┌─────────────────────────────────┐
│  Google Drive Setup (3/4)      │
│  Folder URL: [__________]      │
│  [Skip] [Next →]                │
└─────────────────────────────────┘
   ↓
┌─────────────────────────────────┐
│  Network Configuration (4/4)   │
│  Port: [3000]                  │
│  IP: 192.168.1.100 (auto)      │
│  [Complete Setup]               │
└─────────────────────────────────┘
   ↓
4. Save to electron-store:
   - app_mode: "server"
   - server_port: 3000

5. Save to database:
   - Office info in AppSettings
   - Admin user in Users table

6. Start services:
   - Database ✓
   - HTTP API (Port 3000) ✓
   - Google Drive watcher ✓

7. Show login screen → Admin logs in → Main app
```

### Flow 2: Initial Setup - Client

```
1. Download Taxia-Setup.exe (same file)
2. Run installer
3. First launch
   ↓
┌─────────────────────────────────┐
│  Is this server or client?     │
│  [🖥️ Server] [💻 Client]       │
└─────────────────────────────────┘
   ↓ Click "Client"
┌─────────────────────────────────┐
│  Connect to Server (1/2)       │
│  Server IP: [192.168.1.100]    │
│  Port: [3000]                  │
│  [Test Connection]             │
│  ✅ Connected!                  │
│  [Next →]                       │
└─────────────────────────────────┘
   ↓
┌─────────────────────────────────┐
│  Login (2/2)                   │
│  Email: [__________]           │
│  Password: [__________]        │
│  □ Remember me                 │
│  [Login]                        │
│                                 │
│  💡 Ask admin for account       │
└─────────────────────────────────┘
   ↓
4. Save to electron-store:
   - app_mode: "client"
   - server_url: "http://192.168.1.100:3000"

5. Authenticate with server:
   - POST /api/auth/login
   - Receive JWT token
   - Store token in memory

6. Main app opens
```

### Flow 3: Daily Usage - Server (Admin)

```
Morning:
1. Turn on server PC
2. Taxia auto-starts (if configured)
3. Login screen → Auto-login if "Remember me"
4. Main app opens
   ↓
5. Google Drive service running in background
   └─ Watching folder for new recordings
   ↓
6. Admin uses app just like clients:
   ├─ View calls
   ├─ Create tasks
   ├─ Manage clients
   └─ Admin-only features:
       ├─ User management (Settings → Users)
       ├─ Office settings
       └─ Google Drive config
```

### Flow 4: Daily Usage - Client (Staff)

```
Morning:
1. Turn on PC
2. Open Taxia
3. Login → Auto-login if "Remember me"
4. Main app opens
   ↓
Throughout the day:

When working on tasks:
   └─ Navigate to Tasks tab
   └─ See tasks assigned to them
   └─ Update progress, status
   └─ Add comments in chat

When client calls:
   └─ Navigate to Clients tab
   └─ Search for client
   └─ View client info and history
   └─ Update notes

When new call arrives (polling every 10 sec):
   └─ App refreshes Calls tab
   └─ See new call with transcript
   └─ Review extracted tasks
   └─ Click "Add to Tasks" for relevant ones
```

---

## 5. Technical Stack

### Frontend (Renderer Process)

```
Framework: React 18
UI Components: Radix UI + Tailwind CSS
State Management: React useState/useEffect
Layout: react-resizable-panels
Forms: Native HTML5 + validation
Icons: Heroicons
Real-time: Polling (10 sec interval)
```

### Backend (Main Process)

```
Runtime: Electron 33
Language: TypeScript
Database: SQLite + Prisma ORM
HTTP Server: Express.js
Settings: electron-store
File I/O: Node.js fs
Authentication: JWT (jsonwebtoken)
Password Hashing: bcrypt
```

### External Services

```
Google Drive: API v3 + Push notifications
OpenAI: Whisper API (STT) + GPT-4 (task extraction)
Webhook: LocalTunnel (dev) / ngrok (production)
```

---

## 6. Database Schema

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String   // bcrypt hashed
  role      String   // "admin" | "user" | "taxia"
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  calls     Call[]
  messages  Message[]
}

model Client {
  id                        Int      @id @default(autoincrement())
  companyName               String
  representative            String
  businessRegistrationNumber String
  contactNumber             String
  email                     String
  address                   String
  assignee                  String
  contractDate              String
  status                    String   @default("active")
  notes                     String?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  calls                     Call[]
  tasks                     Task[]
  messages                  Message[]
}

model Call {
  id                 Int       @id @default(autoincrement())
  clientId           Int?
  userId             Int?
  date               String
  callerName         String
  phoneNumber        String
  recordingFileName  String
  transcriptFileName String?
  callDuration       String
  transcript         String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  client             Client?   @relation(fields: [clientId], references: [id])
  user               User?     @relation(fields: [userId], references: [id])
  tasks              Task[]
  messages           Message[]
}

model Task {
  id          Int       @id @default(autoincrement())
  callId      Int?
  clientId    Int?
  title       String
  assignee    String
  status      String    @default("pending")
  startDate   String
  dueDate     String
  progress    Int       @default(0)
  category    String
  tags        String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  call        Call?     @relation(fields: [callId], references: [id])
  client      Client?   @relation(fields: [clientId], references: [id])
  subtasks    Subtask[]
  messages    Message[]
}

model Subtask {
  id        Int      @id @default(autoincrement())
  taskId    Int
  title     String
  assignee  String?
  status    String   @default("pending")
  dueDate   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
}

model Message {
  id        Int      @id @default(autoincrement())
  userId    Int
  content   String
  timestamp DateTime @default(now())
  metadata  String?

  taskId    Int?
  clientId  Int?
  callId    Int?

  user      User     @relation(fields: [userId], references: [id])
  task      Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  client    Client?  @relation(fields: [clientId], references: [id], onDelete: Cascade)
  call      Call?    @relation(fields: [callId], references: [id], onDelete: Cascade)
}

model AppSettings {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Settings Storage Strategy

**Server-Only Settings (AppSettings table in DB):**
```
office_name: "세무법인 OO"
office_representative: "홍길동"
office_contact: "02-1234-5678"
office_address: "서울시..."
allow_client_registration: "false"
```

**Server Local Settings (electron-store config.json):**
```json
{
  "app_mode": "server",
  "server_port": 3000,
  "google_drive_folder_id": "1msdV34Tbx..."
}
```

**Client Local Settings (electron-store config.json):**
```json
{
  "app_mode": "client",
  "server_url": "http://192.168.1.100:3000",
  "last_logged_in_user": "staff1@office.com",
  "theme": "light"
}
```

---

## 7. API Design

### Authentication Endpoints

```
POST   /api/auth/login              Login and get JWT
POST   /api/auth/logout             Logout
GET    /api/auth/me                 Get current user
```

### Client Endpoints

```
GET    /api/clients                 List all clients
POST   /api/clients                 Create client
GET    /api/clients/:id             Get client by ID
PUT    /api/clients/:id             Update client
DELETE /api/clients/:id             Delete client
```

### Call Endpoints

```
GET    /api/calls                   List all calls
GET    /api/calls/:id               Get call by ID
GET    /api/calls/:id/audio         Stream audio file
GET    /api/calls/:id/transcript    Get transcript
```

### Task Endpoints

```
GET    /api/tasks                   List all tasks
POST   /api/tasks                   Create task
GET    /api/tasks/:id               Get task by ID
PUT    /api/tasks/:id               Update task
DELETE /api/tasks/:id               Delete task
GET    /api/tasks/:id/subtasks      List subtasks
POST   /api/tasks/:id/subtasks      Create subtask
```

### Message Endpoints

```
GET    /api/messages?context=task:1  Get messages by context
POST   /api/messages                 Create message
```

### User Endpoints (Admin only)

```
GET    /api/users                   List users (exclude Taxia bot)
POST   /api/users                   Create user
PUT    /api/users/:id               Update user
DELETE /api/users/:id               Delete user
```

### Settings Endpoints (Admin only)

```
GET    /api/settings                Get all shared settings
PUT    /api/settings                Update settings
```

### Authentication

All API endpoints (except `/api/auth/login`) require JWT token:

```
Headers:
  Authorization: Bearer <jwt-token>
```

### Error Responses

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## 8. File Structure

```
taxia-desktop/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── app.ts                 # Main entry point
│   │   ├── services/
│   │   │   ├── settings.service.ts      # electron-store
│   │   │   ├── database.service.ts      # SQLite + Prisma
│   │   │   ├── dataAccess.service.ts    # Interface + implementations
│   │   │   ├── api.service.ts           # Express HTTP server
│   │   │   ├── auth.service.ts          # JWT handling
│   │   │   ├── googleDrive.service.ts   # Google Drive API
│   │   │   ├── openai.service.ts        # OpenAI API
│   │   │   ├── webhook.service.ts       # Webhook receiver
│   │   │   └── fileDetection.service.ts # File processing
│   │   └── interfaces.ts
│   │
│   ├── renderer/                  # React UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── LoginScreen.tsx
│   │   │   ├── setup/
│   │   │   │   ├── SetupWizard.tsx
│   │   │   │   ├── ModeSelection.tsx
│   │   │   │   ├── ServerSetup/
│   │   │   │   │   ├── OfficeInfo.tsx
│   │   │   │   │   ├── AdminAccount.tsx
│   │   │   │   │   ├── GoogleDriveSetup.tsx
│   │   │   │   │   └── NetworkConfig.tsx
│   │   │   │   └── ClientSetup/
│   │   │   │       ├── ServerConnection.tsx
│   │   │   │       └── UserLogin.tsx
│   │   │   ├── tabs/
│   │   │   │   ├── HomeTab.tsx
│   │   │   │   ├── CallsTab.tsx
│   │   │   │   ├── TasksTab.tsx
│   │   │   │   ├── ClientsTab.tsx
│   │   │   │   └── SettingsTab.tsx
│   │   │   ├── shared/
│   │   │   │   ├── ResizableTable.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   └── ...
│   │   │   └── ui/
│   │   │       └── (Radix UI components)
│   │   └── hooks/
│   │       └── useAuth.ts
│   │
│   ├── shared/                    # Shared types & constants
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   │
│   └── preload/
│       └── index.ts               # IPC bridge
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── assets/
│   ├── icon.ico                   # Windows icon
│   └── icon.icns                  # macOS icon
│
├── forge.config.ts                # Electron Forge config
├── vite.main.config.ts
├── vite.renderer.config.ts
├── vite.preload.config.ts
├── tsconfig.json
├── package.json
├── .env.example
└── SYSTEM_DESIGN.md              # This file
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1)

#### Day 1-2: Settings & Mode Detection
- ✅ Install electron-store
- ✅ Create SettingsService
- ✅ Add app mode detection
- ✅ Router logic (setup vs login vs main)
- ✅ Test mode persistence

#### Day 3-4: Setup Wizard UI
- ✅ Mode selection screen
- ✅ Server setup screens (4 steps)
  - Office information
  - Admin account creation
  - Google Drive setup (optional)
  - Network configuration
- ✅ Client setup screens (2 steps)
  - Server connection
  - User login
- ✅ Form validation
- ✅ Password requirements (8+ chars, uppercase, lowercase, number)

#### Day 5: Data Access Layer
- ✅ Create DataAccessService interface
- ✅ Implement LocalDataAccess (server - direct DB)
- ✅ Prepare RemoteDataAccess stub (client)

---

### Phase 2: Server API (Week 2)

#### Day 6-7: HTTP API Server
- ✅ Setup Express in main process
- ✅ JWT authentication middleware
- ✅ Implement all REST endpoints
  - Auth (login, logout, me)
  - Clients (CRUD)
  - Calls (list, get, audio)
  - Tasks (CRUD, subtasks)
  - Messages (by context, create)
  - Users (CRUD - admin only)
  - Settings (get, update - admin only)
- ✅ Error handling
- ✅ Request validation

#### Day 8-9: Client API Integration
- ✅ Implement RemoteDataAccess
- ✅ Replace server IPC with data access layer
- ✅ Update all components to use abstraction
- ✅ Add polling mechanism (every 10 seconds)
- ✅ Handle authentication (JWT storage)

#### Day 10: Testing
- ✅ Test server mode fully
- ✅ Test client mode fully
- ✅ Test multi-client scenarios
- ✅ Test call processing flow
- ✅ Test user management

---

### Phase 3: Polish & Deploy (Week 3)

#### Day 11-12: Build Configuration
- ✅ Configure forge.config.ts for distribution
- ✅ Create app icons (.ico, .icns)
- ✅ Build Windows installer (.exe)
- ✅ Build macOS installer (.dmg) if needed
- ✅ Test auto-update mechanism (optional)

#### Day 13-14: Installation Testing
- ✅ Test fresh install on Windows
- ✅ Test fresh install on macOS
- ✅ Test server setup wizard
- ✅ Test client setup wizard
- ✅ Test network connectivity
- ✅ Fix any discovered bugs

#### Day 15: Documentation
- ✅ Server setup guide
- ✅ Client setup guide
- ✅ Admin user guide
- ✅ Staff user guide
- ✅ Troubleshooting guide
- ✅ Network configuration guide

---

## 10. Deployment Guide

### Network Requirements

**Minimum:** Local network (LAN) only

```
Tax Office Network:
├─ Router: 192.168.1.1
├─ Server PC: 192.168.1.100 (static IP recommended)
├─ Client 1: 192.168.1.101
├─ Client 2: 192.168.1.102
└─ Client 3: 192.168.1.103

All connected via office WiFi or ethernet
```

### Server PC Requirements

```
Minimum:
├─ CPU: Quad-core processor
├─ RAM: 8GB (16GB recommended)
├─ Storage: 256GB SSD (for recordings)
├─ OS: Windows 10/11, macOS 10.13+, Ubuntu 18+
├─ Network: 1Gbps ethernet (recommended)
└─ Internet: Required for Google Drive & OpenAI

Recommended:
├─ CPU: 6-core or better
├─ RAM: 16GB
├─ Storage: 512GB SSD
└─ UPS: Backup power recommended
```

### Client PC Requirements

```
Minimum:
├─ CPU: Dual-core processor
├─ RAM: 4GB
├─ Storage: 100MB (app only)
├─ OS: Windows 10/11, macOS 10.13+, Ubuntu 18+
└─ Network: 100Mbps LAN or WiFi

Note: Any office PC from last 10 years works
```

### Server Setup Steps

1. **Network Configuration**
   - Assign static IP to server PC (or DHCP reservation)
   - Note the IP address (e.g., 192.168.1.100)
   - Configure firewall to allow port 3000

2. **Install Taxia**
   - Download Taxia-Setup.exe
   - Run installer
   - Launch Taxia

3. **Initial Setup Wizard**
   - Select "Server" mode
   - Enter office information
   - Create admin account
   - Configure Google Drive (optional)
   - Verify server port (3000)

4. **Verify Services**
   - Check HTTP API: `http://localhost:3000/api/health`
   - Check Google Drive connection
   - Test OpenAI integration

### Client Setup Steps

1. **Network Check**
   - Ensure client can reach server
   - Test: `ping 192.168.1.100`

2. **Install Taxia**
   - Download Taxia-Setup.exe (same file as server)
   - Run installer
   - Launch Taxia

3. **Initial Setup Wizard**
   - Select "Client" mode
   - Enter server URL: `http://192.168.1.100:3000`
   - Test connection (wizard validates)
   - Login with credentials (from admin)

4. **Verify Connection**
   - App should load main interface
   - Test: Create a task, view clients, etc.

### Firewall Configuration

**Windows Server:**
```
1. Windows Defender Firewall
2. Advanced Settings
3. Inbound Rules → New Rule
4. Port → TCP → 3000
5. Allow the connection
6. Apply to Domain, Private, Public
7. Name: "Taxia Server"
```

**macOS Server:**
```
1. System Preferences → Security & Privacy
2. Firewall → Firewall Options
3. Click (+) → Add Taxia.app
4. Allow incoming connections
```

### Troubleshooting

**Client can't connect to server:**
```
1. Check server IP: ipconfig (Windows) or ifconfig (Mac)
2. Ping server: ping 192.168.1.100
3. Check firewall: telnet 192.168.1.100 3000
4. Verify server is running: Check server PC
5. Check network: Same subnet?
```

**Google Drive not working:**
```
1. Check internet connection on server
2. Verify service account credentials
3. Check folder ID in settings
4. Check webhook status
```

**OpenAI transcription fails:**
```
1. Check internet connection
2. Verify API key in settings
3. Check audio file format (must be .wav, .mp3, etc.)
4. Check OpenAI account credits
```

---

## 11. Key Decisions

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Server GUI** | Yes - Admin can use it as workstation | Simpler for tax office, admin needs UI too |
| **Database** | Server-only (SQLite) | Single source of truth, no sync complexity |
| **Client database** | None (API only) | Simpler, no local storage needed |
| **Settings storage** | electron-store for both server & client | Lightweight, type-safe, persistent |
| **Shared settings** | AppSettings table in server DB | Centralized, accessible via API |
| **Server data access** | Direct DB (LocalDataAccess) | Fastest, no HTTP overhead |
| **Client data access** | HTTP API (RemoteDataAccess) | Standard REST API pattern |
| **Real-time updates** | Polling (10 sec) for MVP | Simpler than WebSocket, good enough |
| **Authentication** | JWT tokens | Stateless, standard, secure |
| **Password hashing** | bcrypt | Industry standard |
| **API server** | Embedded Express in main process | Single process, shared DB connection |

### Technology Decisions

| Technology | Choice | Alternative Considered |
|------------|--------|----------------------|
| **Desktop framework** | Electron | Tauri (too new), Qt (C++) |
| **Frontend** | React | Vue, Svelte |
| **Database** | SQLite | PostgreSQL (overkill), MySQL |
| **ORM** | Prisma | TypeORM, Sequelize |
| **HTTP server** | Express | Fastify, Koa |
| **Settings** | electron-store | JSON file, SQLite |
| **UI components** | Radix UI + Tailwind | Material-UI, Ant Design |
| **State management** | React hooks | Redux (overkill), Zustand |

### Security Decisions

| Aspect | Implementation |
|--------|----------------|
| **Network** | Local network only (no public internet) |
| **Authentication** | JWT with short expiration (24h) |
| **Passwords** | bcrypt with salt rounds = 10 |
| **API** | All endpoints require authentication (except login) |
| **HTTPS** | Not needed on local network for MVP |
| **Data at rest** | SQLite file (can encrypt later if needed) |
| **Data in transit** | HTTP on local network (HTTPS for production) |

### Future Considerations

**Not in MVP, but planned:**

1. **WebSocket for real-time updates** - Better UX than polling
2. **VPN support** - For remote work (Tailscale recommended)
3. **Database encryption** - SQLCipher for sensitive data
4. **HTTPS** - SSL/TLS for production deployment
5. **Auto-update** - electron-updater integration
6. **Backup system** - Automated daily backups
7. **Audit log** - Track all data changes
8. **Multi-office support** - Multiple servers syncing
9. **Mobile app** - React Native client
10. **Cloud deployment** - Optional cloud server mode

---

## Password Requirements

### Validation Rules

```typescript
interface PasswordRequirements {
  minLength: 8;
  requireUppercase: true;
  requireLowercase: true;
  requireNumber: true;
  requireSpecial: false; // Optional for MVP
}

function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('8자 이상 입력하세요');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('대문자를 포함하세요');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('소문자를 포함하세요');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('숫자를 포함하세요');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Development vs Production

### Development

```
Server:
├─ LocalTunnel for webhooks
├─ Console logging enabled
├─ DevTools enabled
└─ Hot reload enabled

Environment:
├─ NODE_ENV=development
└─ .env file with secrets
```

### Production

```
Server:
├─ ngrok or static IP for webhooks
├─ File logging only
├─ DevTools disabled
└─ Compiled bundle

Environment:
├─ NODE_ENV=production
└─ Secrets in AppSettings table
```

---

## Success Criteria

### MVP Must Have

- ✅ Server can be installed and configured
- ✅ Admin can create user accounts
- ✅ Clients can connect and login
- ✅ Google Drive integration works
- ✅ Calls are automatically processed (transcribed + tasks extracted)
- ✅ All users can view calls, tasks, clients
- ✅ All users can create/update tasks and clients
- ✅ Real-time sync via polling (acceptable delay < 30 sec)
- ✅ Passwords are secure (bcrypt hashed)
- ✅ Multi-user support (5 concurrent users tested)
- ✅ Stable on Windows 10/11

### Nice to Have (Post-MVP)

- WebSocket for instant updates
- macOS support
- Auto-update mechanism
- Backup/restore functionality
- User activity logs
- Advanced search/filtering
- Dark mode
- Customizable UI

---

**End of System Design Document**

*For questions or clarifications, refer to the implementation roadmap and start with Phase 1, Day 1.*
