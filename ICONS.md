# App Icons Guide

This document explains how app icons are generated and managed for Taxia Desktop.

## Icon Files

The app uses the following icons:

- **Source**: `src/renderer/assets/images/taxia-profile.png` - Original high-resolution image
- **macOS**: `build/icon.icns` - macOS app icon (generated)
- **Windows**: `build/icon.ico` - Windows app icon (generated)
- **Generic**: `build/icon.png` - 256x256 PNG (generated)

## Generating Icons

Icons are automatically generated from the source image during the build process. To manually regenerate icons:

```bash
npm run build:icons
```

Or run the script directly:

```bash
./scripts/generate-icons.sh
```

## Requirements

- **macOS tools** (built-in):
  - `sips` - Image resizing
  - `iconutil` - Converting iconset to .icns

- **ImageMagick** (for Windows .ico):
  ```bash
  brew install imagemagick
  ```

## Icon Sizes

### macOS (.icns)
The iconset includes the following sizes:
- 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- Each with @2x retina variants

### Windows (.ico)
Multiple sizes embedded in one file:
- 16x16, 32x32, 48x48, 64x64, 96x96, 128x128, 256x256

## Updating the Icon

To change the app icon:

1. Replace `src/renderer/assets/images/taxia-profile.png` with your new image
   - Recommended: Square image, at least 1024x1024 pixels
   - PNG format with transparency

2. Regenerate icons:
   ```bash
   npm run build:icons
   ```

3. Rebuild the app:
   ```bash
   npm run make:mac
   # or
   npm run make:win
   ```

## Configuration

Icons are configured in `forge.config.ts`:

```typescript
packagerConfig: {
  icon: './build/icon', // Electron Forge adds .icns/.ico automatically
}

// For DMG installer icon
new MakerDMG({
  icon: './build/icon.icns',
})
```

## Troubleshooting

### Icon not showing in built app
- Make sure `build/icon.icns` and `build/icon.ico` exist
- Run `npm run build:icons` before building
- Check that `forge.config.ts` has the correct icon path

### ImageMagick errors
- Install or update ImageMagick: `brew install imagemagick`
- Use `magick` command instead of deprecated `convert`

### Icon appears blurry
- Use a higher resolution source image (at least 1024x1024)
- Ensure source image is square
- Avoid JPEG (use PNG with transparency)

## Icon in Different Contexts

- **macOS Dock**: Uses icon from `Taxia.app/Contents/Resources/electron.icns`
- **macOS Finder**: Same as Dock icon
- **DMG Volume Icon**: Configured in `MakerDMG` settings
- **Windows Taskbar**: Uses icon from `.exe` file
- **Windows Installer**: Configured in `MakerSquirrel` settings
