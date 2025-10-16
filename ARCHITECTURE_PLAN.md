# Taxia Desktop - Architecture Plan

## 📋 Project Overview

**Taxia Desktop** is a tax office workflow management system for 5-person teams that:
- Manages client calls with automatic transcription
- Tracks client companies and contact information
- Automates task generation from call recordings via Google Drive integration
- Enables collaborative work assignment among tax office staff

## 🏗️ Architecture Decision

### **Primary Server + Client Architecture** ✅ **SELECTED**

```
[Server PC] ← Local Network → [Client PC 1]
     ↑                        [Client PC 2]
     ↓                        [Client PC 3]
[SQLite Database]             [Client PC 4]
[File Storage]
[REST API Server]             [Future: Mobile Apps]
```

### **Why This Architecture:**
- ✅ Most conventional and reliable for business applications
- ✅ Centralized security and easier compliance for tax data
- ✅ Simple backup strategy (one location)
- ✅ Easy troubleshooting and maintenance
- ✅ Proven scalability pattern

## 📱 App Distribution Strategy

### **Single App with Runtime Configuration**
- One Electron app that can run in multiple modes:
  - **Server Mode**: Hosts database and API server
  - **Client Mode**: Connects to existing server
  - **Standalone Mode**: For testing/demo purposes

### **Startup Flow:**
```
App Launch → Configuration Screen:
├── "Start as Server" → Becomes database host
├── "Connect to Server" → Input server IP address
└── "Standalone Mode" → Local-only operation
```

## 🔧 Technical Stack

### **Database Layer:**
- **SQLite** with **Prisma ORM**
- Type-safe database access
- Auto-generated TypeScript types
- Built-in migrations

### **Server Layer:**
- **Fastify** REST API server (embedded in server mode)
- **WebSocket** for real-time updates
- **File system** storage for audio files and transcripts

### **Client Layer:**
- **Electron** with **React** frontend
- **IPC communication** with main process
- **HTTP client** for server communication

### **Current Integrations:**
- **Google Drive API** for file upload detection
- **LocalTunnel** for webhook endpoints

## 📊 Data Models

### **Core Entities:**
1. **Calls** - Phone call records with audio/transcript files
2. **Clients** - Company information and contacts
3. **Tasks** - Work items generated from calls or manually created

### **Relationships:**
- One Client → Many Calls
- One Call → Many Tasks
- Tasks assigned to staff members

## 🚀 Implementation Phases

### **Phase 1: Database Foundation**
- [ ] Set up Prisma schema with SQLite
- [ ] Create database models for Calls, Clients, Tasks
- [ ] Implement database service layer
- [ ] Generate TypeScript types

### **Phase 2: Server Mode**
- [ ] Embed Fastify API server in Electron main process
- [ ] Create REST endpoints for CRUD operations
- [ ] Implement real-time WebSocket updates
- [ ] Add authentication/authorization

### **Phase 3: Client Mode**
- [ ] HTTP client service for server communication
- [ ] Replace mock data with real API calls
- [ ] Implement real-time UI updates
- [ ] Handle offline/connection states

### **Phase 4: Full Functionality**
- [ ] Connect Google Drive processing to real database
- [ ] Implement search, filtering, and sorting
- [ ] Add data validation and error handling
- [ ] Comprehensive testing

### **Phase 5: Mobile Expansion (Future)**
- [ ] REST API already supports mobile clients
- [ ] React Native/Flutter mobile app
- [ ] Mobile-optimized UI for task management

## 🔒 Security Considerations

### **Tax Office Requirements:**
- Local data storage (no cloud dependency)
- Encrypted database connections
- Audit trails for data access
- Secure file storage for sensitive documents
- Network access controls

### **Implementation:**
- HTTPS for all API communication
- JWT tokens for client authentication
- Database encryption at rest
- Secure file upload/download endpoints

## 📱 Mobile Expansion Impact

### **Current Design Supports Mobile:**
- REST API architecture is mobile-ready
- Stateless server design
- JSON-based communication
- WebSocket for real-time updates

### **Mobile Implementation Effort: LOW** 🟢
- Server architecture already supports multiple clients
- API endpoints designed for any client type
- No additional backend work needed
- Mobile app would be pure frontend development

## 🎯 Target Customer Profile

- **Size**: 5-person tax office teams
- **Current State**: Using paid SaaS solutions
- **Network**: Reliable local network infrastructure
- **Requirements**: High security, zero data loss tolerance
- **Budget**: Cost-conscious, prefers one-time purchase over subscriptions

## 📦 Deployment Strategy

### **MVP Delivery:**
1. Single installer for all team members
2. Setup wizard for server/client configuration
3. Automatic database initialization
4. Built-in backup/restore functionality

### **Update Strategy:**
- Auto-update mechanism
- Database migration handling
- Backward compatibility support

---

## 🎉 Key Benefits of This Plan

1. **Future-Proof**: Mobile expansion ready without architectural changes
2. **Cost-Effective**: No ongoing cloud costs or licensing fees
3. **Secure**: Data stays on-premises with enterprise-grade security
4. **Scalable**: Can grow from 5 to 50+ users with same architecture
5. **Reliable**: Proven architecture pattern used by thousands of applications