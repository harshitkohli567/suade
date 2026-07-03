# Suade — Word Add-in (Phase 1 scaffold)

Contextually-aware, point-of-work AI for arbitration lawyers. See the PRD
for full product context. This is Phase 1, Step 1: the project shape only —
a Word task pane that proves it loads correctly. No cursor tracking, no
Skills, no Claude calls yet.

## Prerequisites

- Node.js 18+
- Word desktop (not Word Online) — macOS or Windows
- On first run, you'll be prompted to trust a locally-generated dev
  certificate (via `office-addin-dev-certs`) so Word can load the add-in
  over HTTPS from `localhost`. Accept it when prompted.

## Setup

```bash
npm install
```

## Run locally

```bash
npm run dev-server   # starts the webpack dev server on https://localhost:3000
```

In a second terminal:

```bash
npm start             # sideloads the add-in into Word and launches it
```

`npm start` uses `office-addin-debugging`, which registers the manifest
with Word and opens it for you. If it doesn't open automatically: open
Word manually, go to **Insert → Add-ins → My Add-ins → Shared Folder** (or
**Upload My Add-in** on Windows) and point it at `manifest.xml`.

To stop and unregister the sideloaded add-in:

```bash
npm run stop
```

## Acceptance check for Step 1

Open Word with the add-in sideloaded, click the Suade button on the
ribbon's Home tab. The task pane should open and show:

> **Suade**
> Task pane scaffold — Phase 1, Step 1.
> If you can see this inside Word, sideloading and the Office.js bootstrap
> are working. Cursor and selection tracking lands in Step 2.

If you see that, Step 1 is done — move to Step 2 (cursor/selection
tracking, `FR-1.1`).

## Project structure

```
manifest.xml              Dev manifest — points at https://localhost:3000
webpack.config.js         Bundles taskpane + commands entry points, dev server + HTTPS certs
src/
  taskpane/
    taskpane.html          HTML shell, loads office.js from CDN
    index.tsx               React bootstrap, waits on Office.onReady
    App.tsx                  Root component (placeholder for Step 1)
  commands/
    commands.html/.ts       Required by manifest's FunctionFile; unused in Phase 1
  types/
    index.ts                 Shared types mirroring the PRD's data model (Section 12)
  data/
    skills/                   Empty — Skill Registry lands in Step 4
    matters/                  Empty — Matter Repository CSV lands here (Step 3/9)
assets/                    Placeholder ribbon icons (16/32/64/80px)
```

## Known placeholders (intentional, not bugs)

- `assets/icon-*.png` are generated placeholders (navy square, "S"). Swap
  for real branding whenever design is ready — not a Step 1 blocker.
- `manifest.xml`'s `<Id>` is a fixed dev GUID. Generate a real one before
  any shared/production manifest.
- `commands.ts` registers no ribbon functions — intentional per Phase 1
  scope (see file comment).
