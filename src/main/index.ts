// Main entry point - delegates to the app class
import { taxiaApp } from './app';

// Initialize and start the application
async function main() {
  try {
    await taxiaApp.initialize();
    console.log('🚀 Taxia Desktop App initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Taxia Desktop App:', error);
    process.exit(1);
  }
}

// Start the application
main();
