#!/bin/bash

# Generate icons from source PNG for macOS and Windows
# Usage: ./scripts/generate-icons.sh

set -e

SOURCE_IMAGE="src/renderer/assets/images/taxia-profile.png"
BUILD_DIR="build"
ICONSET_DIR="$BUILD_DIR/icon.iconset"

echo "🎨 Generating app icons from $SOURCE_IMAGE..."

# Create build directory
mkdir -p "$BUILD_DIR"
mkdir -p "$ICONSET_DIR"

# Step 1: Create base 1024x1024 image
echo "🖼️  Creating base image..."
magick "$SOURCE_IMAGE" -resize 1024x1024 -gravity center -extent 1024x1024 "$BUILD_DIR/taxia-base.png"

# Step 2: Create rounded rectangle mask (22% corner radius = 225px for 1024x1024)
echo "✂️  Creating rounded mask..."
magick -size 1024x1024 xc:none -fill white -draw "roundrectangle 0,0 1023,1023 225,225" "$BUILD_DIR/mask.png"

# Step 3: Apply mask to create rounded icon
echo "🎭 Applying rounded corners..."
magick "$BUILD_DIR/taxia-base.png" "$BUILD_DIR/mask.png" -alpha off -compose CopyOpacity -composite "$BUILD_DIR/icon-rounded.png"

# Step 4: Add 10% padding for proper macOS appearance
echo "📐 Adding padding..."
magick "$BUILD_DIR/icon-rounded.png" -background none -gravity center -extent 1228x1228 -resize 1024x1024 "$BUILD_DIR/icon-final.png"

# Generate macOS iconset (multiple sizes from the final rounded icon)
echo "📱 Creating macOS icon sizes..."
sips -z 16 16 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$BUILD_DIR/icon-final.png" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null

# Convert iconset to .icns
echo "🍎 Creating macOS .icns file..."
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"

# Generate Windows .ico (requires ImageMagick)
echo "🪟 Creating Windows .ico file..."
if command -v magick &> /dev/null; then
    magick "$BUILD_DIR/icon-final.png" -define icon:auto-resize=256,128,96,64,48,32,16 "$BUILD_DIR/icon.ico"
elif command -v convert &> /dev/null; then
    convert "$BUILD_DIR/icon-final.png" -define icon:auto-resize=256,128,96,64,48,32,16 "$BUILD_DIR/icon.ico"
else
    echo "⚠️  ImageMagick not found. Skipping Windows .ico generation."
    echo "   Install with: brew install imagemagick"
fi

# Generate generic PNG (256x256)
echo "🖼️  Creating generic PNG..."
sips -z 256 256 "$BUILD_DIR/icon-final.png" --out "$BUILD_DIR/icon.png" >/dev/null

# Clean up temporary files
echo "🧹 Cleaning up temporary files..."
rm -f "$BUILD_DIR/taxia-base.png" "$BUILD_DIR/mask.png" "$BUILD_DIR/icon-rounded.png"

echo "✅ Icon generation complete!"
echo "   macOS: $BUILD_DIR/icon.icns"
echo "   Windows: $BUILD_DIR/icon.ico"
echo "   PNG: $BUILD_DIR/icon.png"
