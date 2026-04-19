# App Icons — Required Before Building

Place your icons in this directory before running `npm run electron:package`.

| File              | Platform | Required size             |
|-------------------|----------|---------------------------|
| `icon.icns`       | macOS    | 512×512 (icns bundle)     |
| `icon.ico`        | Windows  | 256×256 multi-res ICO     |
| `icon.png`        | Linux    | 512×512 PNG               |

## Generating icons from a single source PNG

If you have a 1024×1024 source PNG (e.g. `icon-src.png`), you can use:

```bash
# macOS .icns  (requires Xcode command-line tools)
mkdir icon.iconset
sips -z 16 16     icon-src.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon-src.png --out icon.iconset/icon_32x32.png
sips -z 128 128   icon-src.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon-src.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon-src.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset -o icon.icns

# Windows .ico  (requires ImageMagick)
magick icon-src.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Linux .png
cp icon-src.png icon.png
```

> If no icons are provided, electron-builder will use the default Electron icon,
> which is fine for local testing but should be replaced before distributing.
