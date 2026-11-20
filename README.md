# 🖼️ Image to JPG & WEBP Converter

A fast, private, 100% client-side image converter and optimizer built with **React 19**, **TypeScript**, and **Vite**. Convert and compress standard web images, Apple HEIC/HEIF, TIFF, and high-resolution camera RAW files directly in your web browser—no uploads, no server processing, and zero privacy compromises.

---

## ✨ Features

- 🔒 **100% Client-Side & Private**  
  All processing happens entirely in your browser using Web APIs and WebAssembly. Your photos and sensitive images never leave your machine.
- ⚡ **Universal Format Support**  
  Convert standard images (`PNG`, `WEBP`, `GIF`, `BMP`, `AVIF`, `SVG`, `JPEG`) to standard **JPG** or modern **WEBP**.
- 📸 **Camera RAW & HEIC / TIFF Decoding**  
  Built-in support for Apple HEIC/HEIF (`.heic`, `.heif`), TIFF (`.tif`, `.tiff`), and digital camera RAW formats:
  - Canon (`.cr2`, `.cr3`)
  - Nikon (`.nef`)
  - Sony (`.arw`, `.sr2`)
  - Fujifilm (`.raf`)
  - Adobe Digital Negative (`.dng`)
  - Olympus (`.orf`)
  - Panasonic (`.rw2`)
  - Pentax (`.pef`)
  - Generic RAW (`.raw`)
- 🔍 **Smart Binary RAW Extraction & EXIF Metadata**  
  High-speed binary scanner searches structural JPEG stream markers (`FF D8 FF` to `FF D9`) and extracts full-resolution embedded previews from camera RAW files, along with EXIF camera model and dimension tags.
- 🎚️ **Customizable Quality & Compression**  
  Interactive quality slider from **1%** to **100%** with quick presets (*Smaller File*, *Balanced*, *Best Quality*). Shows original vs. converted file size and exact compression savings.
- 📦 **Batch Conversion & ZIP Download**  
  Convert multiple files at once. Download converted images individually or package all successful conversions into a single `.zip` file with one click.
- 🎨 **Modern, Accessible UI**  
  Clean dark theme built following Jakob Nielsen's usability heuristics—complete with drag-and-drop, real-time status feedback, keyboard navigation, and responsive layout.

---

## 📂 Supported Formats

| Category | Extensions | Processing Method |
| :--- | :--- | :--- |
| **Standard Images** | `.png`, `.webp`, `.gif`, `.bmp`, `.svg`, `.avif`, `.jpg`, `.jpeg` | Native Browser Canvas / HTMLImageElement |
| **Apple iOS Photos** | `.heic`, `.heif` | Client-side transcoding via `heic2any` |
| **High-Bitrate TIFF** | `.tiff`, `.tif` | Decoded via `utif` & Canvas rendering |
| **Camera RAW** | `.cr2`, `.cr3`, `.nef`, `.arw`, `.raf`, `.dng`, `.orf`, `.rw2`, `.pef`, `.sr2`, `.raw` | High-efficiency binary JPEG stream parser & `exifreader` |

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Image & Metadata Libraries**:
  - [`heic2any`](https://www.npmjs.com/package/heic2any) — HEIC/HEIF to canvas/blob conversion
  - [`utif`](https://www.npmjs.com/package/utif) — Fast TIFF parsing & RGBA rasterization
  - [`exifreader`](https://www.npmjs.com/package/exifreader) — Comprehensive EXIF, IPTC, and XMP metadata extraction
  - [`jszip`](https://www.npmjs.com/package/jszip) — In-browser ZIP archive generation

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher (Node 20+ recommended)
- **Package Manager**: `npm`, `yarn`, or `pnpm`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/1991Rajib/JPG_converter.git
   cd JPG_converter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

---

## 🏗️ Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server with Hot Module Replacement (HMR) |
| `npm run build` | Compiles TypeScript (`tsc -b`) and generates optimized production bundle in `dist/` |
| `npm run preview` | Locally serves the production build for testing and verification |
| `npm run lint` | Runs ESLint to check for code quality and TypeScript standards |

---

## 🧠 Architecture & How It Works

1. **Upload & Type Detection**: Files are captured via drag-and-drop or file picker. MIME types and file extensions are parsed and mapped to their respective processing paths.
2. **Metadata & Preview Extraction**:
   - For standard images, an Object URL is created.
   - For HEIC, `heic2any` converts the buffer to a JPEG blob.
   - For TIFF, `UTIF.decode` and `UTIF.toRGBA8` decode image bands into raw pixel data rendered on an off-screen canvas.
   - For RAW formats, an ultra-fast binary marker scanner locates embedded full-resolution JPEG streams without requiring heavy native WASM decoders.
3. **Canvas Compression**:
   - The decoded frame is drawn onto an offscreen HTML Canvas.
   - `canvas.toBlob()` applies the selected output format (`image/jpeg` or `image/webp`) and compression factor (`quality / 100`).
4. **Memory Management**:
   - All generated `blob:` object URLs are tracked and explicitly revoked (`URL.revokeObjectURL`) on file removal or queue cleanup to prevent browser memory leaks.

---

## 📁 Project Structure

```text
JPG_converter/
├── public/                 # Static assets
├── src/
│   ├── assets/             # Images & static media
│   ├── components/         # Reusable UI components
│   │   ├── ConversionSettings.tsx # Format selector, quality slider & bulk actions
│   │   ├── ImageCard.tsx          # Queue card showing preview, dimensions & stats
│   │   └── UploadZone.tsx         # Drag-and-drop upload target
│   ├── utils/
│   │   └── converter.ts    # Decoding, binary parsing & canvas compression logic
│   ├── types.ts            # TypeScript definitions & interfaces
│   ├── App.tsx             # Root application orchestrator
│   ├── App.css             # Component layout styles
│   ├── index.css           # Global typography & design system
│   └── main.tsx            # Vite entry point
├── eslint.config.js        # ESLint configuration
├── index.html              # HTML shell
├── package.json            # Project manifest & dependencies
├── tsconfig.json           # Base TypeScript config
├── tsconfig.app.json       # App-specific TS configuration
├── tsconfig.node.json      # Node/Vite TS configuration
└── vite.config.ts          # Vite build configuration
```

---

## 🔒 Privacy & Security

Unlike traditional online converters that upload your photos to third-party cloud servers, **this converter executes entirely inside your browser's JavaScript sandbox**. No data or telemetry is transmitted across the network, ensuring 100% confidentiality for personal, family, and enterprise photos.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
