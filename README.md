<p align="center">
  <img src="https://raw.githubusercontent.com/npc-worldwide/vixynt/main/vixynt_nobg_keyed_nobg.png" alt="Vixynt logo with a fox holding a paintbrush and camera" width="400" height="400">
</p>

<h1 align="center">Vixynt</h1>

<p align="center">
  <strong>Visualize. Imagine. Create.</strong>
</p>

<p align="center">
  <a href="https://github.com/npc-worldwide/vixynt/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/npc-worldwide/vixynt/releases"><img src="https://img.shields.io/github/v/release/npc-worldwide/vixynt?include_prereleases" alt="Release"></a>
  <a href="https://github.com/npc-worldwide/vixynt/actions/workflows/build.yaml"><img src="https://github.com/npc-worldwide/vixynt/actions/workflows/build.yaml/badge.svg" alt="Build Status"></a>
</p>

<p align="center">
  <a href="https://github.com/npc-worldwide/vixynt/releases"><strong>Download for Linux, macOS, and Windows</strong></a>
</p>

---

Vixynt is a focused, desktop-first creative studio for images, diffusion models, and short-form video. It brings together photo management, AI generation, editing, and model training in one fast, keyboard-friendly workspace.

Built on Electron + React with a Python backend, Vixynt keeps your media workflow local by default and lets you plug in cloud image/video providers when you need them.

### Highlights

- **Gallery & Library** — Browse, sort, filter, rename, and manage images across tracked folders. Grid and list views with metadata, lightbox navigation, and batch selection.
- **AI Image Generation** — Generate images from text prompts using local diffusers or cloud providers (OpenAI, Gemini, Anthropic, Stability, Replicate, Fal.ai, Together, Fireworks, DeepInfra, BFL/Flux, and more).
- **DarkRoom Editor** — Edit photos with the [npcts](https://github.com/npc-worldwide/npcts) `ImageEditor`, including AI generative fill on selected regions.
- **Video Generation** — Create short AI-generated video clips from prompts or image references.
- **Video Editor** — Arrange clips on a timeline with tracks, transitions, text layers, and playback controls.
- **Animation Studio** — Build frame-based animations with adjustable timing and preview playback.
- **Game Engine** — A lightweight physics sandbox for prototyping simple 2D scenes with circles, squares, and platforms.
- **Diffusion Fine-Tuning** — Train custom diffusion models on your own image selections with configurable epochs, batch size, and learning rate.
- **Workflow Editor** — Chain nodes for loading, generating, upscaling, adjusting, masking, filling, and saving images.
- **Local-first** — Your images and models stay on disk. Optional cloud providers require explicit API keys stored in settings.

---

## Setup

### 1. Install

Download the installer for your platform from the [releases page](https://github.com/npc-worldwide/vixynt/releases), run it, and launch Vixynt. Linux (`.deb`/`.AppImage`), macOS (`.dmg`/`.zip`), and Windows (`.exe`) builds are provided.

### 2. First launch

On first launch Vixynt opens with a default workspace path (your home directory). You can change the project path from the header path navigator or add tracked folders via the sidebar.

### 3. Connect a model provider

Open **Settings** from the sidebar or mode dropdown and add API keys for any cloud providers you want to use. Keys are stored locally in app settings. If you prefer local generation, configure a Python environment with `torch` + `diffusers` + `transformers` and select it in settings.

Supported cloud providers for image and video generation include:

- OpenAI
- Gemini
- Anthropic
- Stability AI
- Replicate
- Fal.ai
- Together AI
- Fireworks
- DeepInfra
- BFL/Flux
- Bagel
- Leonardo
- Ideogram

### 4. Configure output directories

In **Settings**, set:

- **Default Image Output Directory** — where generated images are saved.
- **Default Model Output Directory** — where fine-tuned diffusion models are saved.
- **Tracked Folders** — quick-access folders for the gallery (Pictures, Photos, Desktop, custom paths, etc.).

### 5. Python backend environment

Vixynt bundles a lightweight Python backend via `vixynt_serve.py`. For AI features that need heavy dependencies (diffusion training, image generation with local models), the app shells out to a configured Python virtual environment instead of bundling those packages:

1. Open **Settings**.
2. Set the **Backend Python Path** or let Vixynt auto-detect Python.
3. Install the needed packages in that environment:
   - `torch torchvision torchaudio`
   - `diffusers transformers accelerate safetensors`

### 6. Troubleshooting

- **Backend not starting** — check the log at `~/.npcsh/vixynt/logs/backend.log` (macOS/Linux) or the equivalent path on Windows.
- **No models available** — add a cloud API key in **Settings** or install a local diffusers environment.
- **Images not loading in gallery** — ensure the tracked folder path exists and contains supported formats (JPG, PNG, WebP, GIF).

---

## Table of Contents

- [Gallery & Media Management](#gallery--media-management)
- [AI Image Generation](#ai-image-generation)
- [DarkRoom Editor](#darkroom-editor)
- [Video Generation](#video-generation)
- [Video Editor](#video-editor)
- [Animation Studio](#animation-studio)
- [Game Engine](#game-engine)
- [Diffusion Fine-Tuning](#diffusion-fine-tuning)
- [Workflow Editor](#workflow-editor)
- [Settings](#settings)
- [Development Setup](#development-setup)
- [Community](#community)
- [License](#license)

---

## Gallery & Media Management

The Gallery is the default workspace for browsing your image collection.

### Tracked Folders

Add any folder from your filesystem to the sidebar. Vixynt watches that folder and shows all supported images. Remove or refresh folders from the sidebar controls.

### Views & Sorting

- **Grid view** — thumbnail browsing with selection.
- **List view** — detailed list with file size, type, and modification date.
- **Sort** by name, type, size, or date; toggle ascending/descending.
- **Filter** by format: All, JPG, PNG, WebP, GIF.

### Selection & Actions

- Click to select, `Shift`/`Ctrl`/`Cmd` + click for multi-select.
- Right-click an image for quick actions: Edit, Use for Generation, Rename, Delete.
- Double-click or press Enter to open the lightbox for fullscreen browsing with keyboard navigation.

---

## AI Image Generation

Generate images from text prompts in the **Image Generate** workspace.

### Features

- Choose a provider and model.
- Set image count, filename base, and dimensions.
- Attach reference images from the gallery for image-to-image or style guidance.
- Generated images are saved to the configured output directory and can be sent back to the gallery or opened in the editor.

### Providers

Cloud generation routes through the configured provider API. Local generation uses diffusers models installed in the active Python environment. Fine-tuned models appear in the model list once training completes.

---

## DarkRoom Editor

The **DarkRoom** workspace opens the selected image in the [npcts](https://github.com/npc-worldwide/npcts) `ImageEditor` for adjustments, crops, filters, and generative fill.

### Generative Fill

Select a region in the editor and describe what you want to fill it with. Vixynt calls the configured image model to generate a replacement that matches the surrounding image.

---

## Video Generation

Switch to **Video Generate** to create short AI videos.

### Features

- Prompt-to-video and image-to-video generation.
- Configurable duration.
- Generated clips can be added to the Video Editor or saved to disk.

---

## Video Editor

The **Video Editor** workspace provides a timeline with video and audio tracks.

### Features

- Drag clips onto tracks.
- Split clips at the playhead.
- Add transitions and text layers.
- Adjust zoom level and playback position.
- Preview playback with play/pause/seek controls.

---

## Animation Studio

The **Animation Studio** workspace lets you build frame-based animations.

### Features

- Add, reorder, and delete frames.
- Set per-frame duration.
- Preview playback with adjustable FPS.
- Drag images directly into frames.

---

## Game Engine

The **Game Engine** workspace is a lightweight 2D physics sandbox.

### Features

- Spawn circles, squares, and static platforms.
- Adjust gravity and pause/resume simulation.
- Click and drag bodies with the mouse.
- Generate a scene from a natural-language prompt (spawns bodies based on keywords).
- Useful for quick prototyping, reference motion, or fun experiments.

---

## Diffusion Fine-Tuning

Train a custom diffusion model on your own images without leaving Vixynt.

### How it works

1. Select images in the Gallery.
2. Open the fine-tune modal from the context menu.
3. Choose captions: none, derived from filenames, or manually entered.
4. Configure output name, epochs, batch size, and learning rate.
5. Start training. Vixynt polls progress and shows loss history.
6. The trained model is saved to the configured model output directory and becomes available for image generation.

Training runs in a separate Python process using the configured backend environment, so the UI stays responsive.

---

## Workflow Editor

The **Workflow** workspace provides a node editor for chaining image operations.

### Node types

- **Load Image** — read an image from disk.
- **Generate** — create an image from a prompt or reference.
- **Upscale** — increase resolution.
- **Adjust** — brightness, contrast, saturation.
- **Filter** — apply stylization.
- **Mask** — create and edit masks.
- **Gen Fill** — fill masked regions with AI.
- **Save** — write the result to disk.

Connect nodes by output/input ports to build reusable pipelines.

---

## Settings

The Settings panel manages app preferences:

- **Tracked Folders** — add/remove quick-access folders.
- **Output Directories** — default paths for images and trained models.
- **Backend Python Path** — Python interpreter used for AI backend tasks.
- **Provider API Keys** — add keys for each cloud image/video provider.
- **AI Features** — enable or disable AI-powered tabs.

Settings are persisted in `localStorage` and the backend config.

---

## Development Setup

Vixynt is an Electron + React + TypeScript frontend with a Python Flask backend powered by [npcpy](https://github.com/npc-worldwide/npcpy).

### Prerequisites

- Node.js 22+ and npm
- Python 3.10+ with [npcpy](https://github.com/npc-worldwide/npcpy) installed
- (Optional) A virtual environment with `torch`, `diffusers`, `transformers`, and `accelerate` for local AI features

### Install

```bash
git clone https://github.com/npc-worldwide/vixynt.git
cd vixynt
npm install --legacy-peer-deps
```

### Run

```bash
# Terminal 1 — backend
python vixynt_serve.py

# Terminal 2 — frontend dev server
npm run dev
```

The dev frontend runs on port `7340` and connects to the backend on port `7140`.

### Build

```bash
npm run build
```

This builds the renderer, Electron main, and preload scripts. To package the Electron app:

```bash
# macOS
npx electron-builder --mac

# Windows
npx electron-builder --win

# Linux
npx electron-builder --linux
```

---

## Community

- **Issues & Bugs**: [GitHub Issues](https://github.com/npc-worldwide/vixynt/issues)
- **NPC Ecosystem**: [npcpy](https://github.com/npc-worldwide/npcpy) | [npcsh](https://github.com/npc-worldwide/npcsh) | [npcts](https://github.com/npc-worldwide/npcts)

---

## License

Vixynt is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
