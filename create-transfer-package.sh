#!/bin/bash

# Script to create a transfer package for Galaxy Book
# This creates a clean zip file without unnecessary files

echo "🎁 Creating transfer package for Galaxy Book..."

# Create output directory
mkdir -p ~/Desktop/taxia-transfer

# Create zip excluding unnecessary files
echo "📦 Zipping project files..."
zip -r ~/Desktop/taxia-transfer/taxia-desktop.zip . \
  -x "node_modules/*" \
  -x ".vite/*" \
  -x "out/*" \
  -x "dist/*" \
  -x "dist-renderer/*" \
  -x "prisma/taxia.db*" \
  -x ".git/*" \
  -x ".DS_Store" \
  -x "*.log"

echo "✅ Package created at: ~/Desktop/taxia-transfer/taxia-desktop.zip"
echo ""
echo "📋 Next steps:"
echo "1. Transfer ~/Desktop/taxia-transfer/taxia-desktop.zip to your Galaxy Book"
echo "2. On Galaxy Book, extract the zip file"
echo "3. Follow the instructions in GALAXY_BOOK_SETUP.md"
echo ""
echo "💡 Quick start on Galaxy Book:"
echo "   cd taxia-desktop"
echo "   npm install"
echo "   npx prisma generate"
echo "   npm run dev"
