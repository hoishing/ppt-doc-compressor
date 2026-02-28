# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend-only web app that compresses images inside PPTX and DOCX files. All processing happens client-side using the Canvas API — no server required. Office files are ZIP archives containing XML and media; the app unzips, parses XML for image display dimensions, resizes/converts images to WebP via Canvas, then re-zips.

**Output requires Office 365+ or LibreOffice 7.4+** (WebP support).

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start Vite dev server
bun run build        # TypeScript compile + Vite production build
bun run preview      # Preview production build
bun run deploy       # Build + deploy to GitHub Pages via gh-pages
```

No test runner or linter is configured.

## Deployment

Hosted on GitHub Pages at `https://hoishing.github.io/ppt-doc-compressor/`. Vite `base` is set to `/ppt-doc-compressor/` in `vite.config.ts` — all asset paths must work under this subpath.

## Architecture

```
src/
  main.ts                    # Entry point, wires UI components together
  ├── ui/
  │   ├── dropzone.ts        # Drag-drop file upload
  │   ├── file-list.ts       # File list display, progress, downloads
  │   ├── settings.ts        # Quality slider + DPI selector
  │   └── theme-toggle.ts    # Light/dark/system theme switcher (persists to localStorage)
  ├── core/
  │   ├── processor.ts       # Orchestrator: unzip → parse → compress → rezip
  │   ├── pptx-parser.ts     # Extracts image dimensions from slide XML
  │   ├── docx-parser.ts     # Extracts image dimensions from document XML
  │   ├── image-compressor.ts # Canvas-based resize + WebP/JPEG encoding
  │   └── content-types.ts   # Updates [Content_Types].xml for new extensions
  └── utils/
      ├── emu.ts             # EMU↔pixel conversion (914,400 EMU = 1 inch)
      └── format.ts          # Byte size formatting
```

**Processing pipeline:** Drop files → `processor.ts` unzips via jszip → parser extracts `ImageDimensions` (media path → width/height in px from EMU values in XML) → `image-compressor.ts` resizes to display dimensions and encodes via Canvas `toBlob()` → content types updated → re-zipped as Blob.

**Theming:** DaisyUI `cupcake` (light) and `dim` (dark) themes, configured in `src/style.css`. Theme toggle cycles system → light → dark, persisted in `localStorage` key `theme-mode`. All UI uses DaisyUI semantic color tokens (`base-100`, `base-content`, `primary`, etc.) so theme switches require no component changes.

## Tech Stack

- **Vanilla TypeScript** — no framework, direct DOM manipulation
- **Vite** — build tool (base path: `/ppt-doc-compressor/`)
- **Tailwind CSS 4 + DaisyUI 5** — styling (`@plugin "daisyui"` in style.css)
- **jszip** — ZIP read/write for Office files
- **file-saver** — triggering downloads

## TypeScript Configuration

Strict mode with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess` enabled. Target ES2021, module bundler resolution.
