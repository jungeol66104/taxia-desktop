# Claude Code Development Guide

This document provides essential patterns and guidelines for developing the Taxia Desktop application with Claude Code.

## 🏗️ Architecture Overview

```
src/
├── main/                    # Electron main process
│   ├── app.ts              # 🎯 Main application class
│   ├── config/             # Configuration management
│   └── services/           # Business logic services
├── renderer/               # React UI application
│   ├── components/         # UI components
│   │   ├── tabs/          # Tab components (Korean UI)
│   │   ├── shared/        # Reusable components
│   │   └── ui/            # Base UI library
│   └── index.tsx          # Main React app
├── shared/                 # Shared code
│   ├── types.ts           # All TypeScript interfaces
│   ├── constants.ts       # App constants
│   ├── utils.ts           # Utility functions
│   └── mockData.ts        # Development data
└── preload/               # Electron preload script
```

## 🎯 Quick Start Patterns

### Adding a New Service

1. **Create interface in `src/main/services/interfaces.ts`:**
```typescript
export interface NewServiceInterface extends BaseService {
  doSomething(): Promise<void>;
}
```

2. **Implement service in `src/main/services/newService.service.ts`:**
```typescript
export class NewService implements NewServiceInterface {
  async start(): Promise<void> { /* implementation */ }
  async stop(): Promise<void> { /* implementation */ }
  isRunning(): boolean { /* implementation */ }
  async doSomething(): Promise<void> { /* implementation */ }
}
```

3. **Add to service factory in `src/main/services/index.ts`:**
```typescript
export function createServices(mainWindow: BrowserWindow, config: AppConfig) {
  const newService = new NewService(config.newService);
  return { /* existing services */, newService };
}
```

### Adding a New Component

1. **Create component in appropriate directory:**
   - Tabs: `src/renderer/components/tabs/`
   - Shared: `src/renderer/components/shared/`
   - UI: `src/renderer/components/ui/`

2. **Export from index file:**
```typescript
// In src/renderer/components/tabs/index.ts
export { default as NewTab } from './NewTab';
```

3. **Use Korean labels for UI, English for code:**
```typescript
const columns: Column[] = [
  { key: 'companyName', label: '회사명', width: 200 },  // ✅ Good
  { key: '회사명', label: '회사명', width: 200 },        // ❌ Avoid
];
```

## 📋 Development Checklist

### Before Adding Features:
- [ ] Check existing patterns in similar components
- [ ] Use shared types from `src/shared/types.ts`
- [ ] Import utilities from `src/shared/utils.ts`
- [ ] Follow service interface pattern
- [ ] Use Korean for UI text, English for code

### Code Quality:
- [ ] Use TypeScript interfaces for all data structures
- [ ] Add error handling with `safeAsync()` utility
- [ ] Use constants from `src/shared/constants.ts`
- [ ] Follow naming convention: English code, Korean UI

### Testing:
- [ ] Test service lifecycle (start/stop)
- [ ] Verify IPC communication works
- [ ] Check Korean UI displays correctly
- [ ] Test error scenarios

## 🔧 Common Patterns

### IPC Communication
```typescript
// Main process
ipcMain.handle('my-action', async (event, data) => {
  return await myService.doSomething(data);
});

// Renderer process
const result = await window.electronAPI.myAction(data);
```

### Service Error Handling
```typescript
import { safeAsync, createError } from '../../shared/utils';

async start(): Promise<void> {
  const result = await safeAsync(
    () => this.initialize(),
    'Failed to start MyService'
  );
  if (!result) {
    throw createError('Service initialization failed');
  }
}
```

### Korean UI with English Code
```typescript
interface ClientData {
  companyName: string;     // English property names
  representative: string;
}

const columns = [
  { key: 'companyName', label: '회사명' },     // Korean labels
  { key: 'representative', label: '대표자' },
];
```

## 🚨 Common Pitfalls

1. **Don't mix languages in code:**
   ```typescript
   // ❌ Avoid
   interface Client { 회사명: string; }

   // ✅ Correct
   interface Client { companyName: string; }
   ```

2. **Don't forget service lifecycle:**
   ```typescript
   // ✅ Always implement BaseService
   class MyService implements BaseService {
     async start(): Promise<void> { }
     async stop(): Promise<void> { }
     isRunning(): boolean { }
   }
   ```

3. **Always use shared constants:**
   ```typescript
   // ❌ Avoid magic numbers
   setTimeout(callback, 5000);

   // ✅ Use constants
   setTimeout(callback, APP_CONSTANTS.TIMING.RETRY_DELAY_MS);
   ```

## 📊 Performance Tips

- Use `debounce()` for search inputs
- Implement proper service cleanup in `stop()` methods
- Use `React.memo()` for expensive components
- Batch IPC calls when possible

## 🎯 This Structure Benefits Claude Code By:

1. **Predictable Patterns** - Every service/component follows same structure
2. **Clear Imports** - Single import points for everything
3. **Self-Documenting** - Function names clearly indicate purpose
4. **Separation of Concerns** - UI, business logic, and data clearly separated
5. **Error Context** - Comprehensive error handling with context
6. **Type Safety** - Full TypeScript coverage with shared interfaces