# Folio — Gemini Project Context

Folio is a local-first, offline-capable Progressive Web App (PWA) for creating and presenting Markdown slides using [Marp Core](https://github.com/marp-team/marp-core). It follows "Quiet Tech" principles: no data leaves the device, no analytics, no accounts, and no background processes.

## Project Overview

- **Purpose**: A focused Markdown-to-slides experience for tablets and Chromebooks.
- **Core Loop**: Write Markdown in a split-pane editor → Real-time Marp preview → Full-screen presentation.
- **Key Technologies**:
  - **Framework**: Angular 21 (Standalone components, Signal-based architecture).
  - **Editor**: CodeMirror 6 with custom Marp syntax highlighting.
  - **Slides Engine**: `@marp-team/marp-core`.
  - **UI**: Angular Material 3 (M3 Expressive) + Angular CDK.
  - **Storage**: `lightning-fs` (IndexedDB-backed POSIX-like filesystem) for `.md` files; raw IndexedDB for preferences.
  - **PWA**: `@angular/pwa` (Workbox) for full offline functionality.

## Architecture

- **State Management**: Centralized `AppStore` using Angular Signals. No NgRx or RxJS-based state managers.
- **Rendering**: Marp renders Markdown to HTML/CSS which is injected into a sandboxed `<iframe>` via `srcdoc` to prevent CSS leakage.
- **Navigation**: Communication between the app shell and the Marp preview happens via `postMessage`.
- **Styling**: SCSS using Material 3 CSS custom properties. No Tailwind CSS.

## Building and Running

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm start` | Run dev server at `http://localhost:4200` |
| `npm run build` | Production build to `dist/` |
| `npm run watch` | Build in watch mode (development configuration) |
| `npm test` | Run unit tests with Vitest |
| `npx prettier --write .` | Format all files |

## Development Conventions

### Angular & TypeScript
- **Standalone Components**: Always use standalone components (default in Angular v21).
- **Signals**: Use `signal`, `computed`, and `effect` for state and side effects. Prefer Signals over Observables for UI state.
- **Change Detection**: Always use `ChangeDetectionStrategy.OnPush`.
- **Inputs/Outputs**: Use `input()`, `output()`, and `model()` functions instead of decorators.
- **Dependency Injection**: Use the `inject()` function instead of constructor injection.
- **Types**: Strict type checking; avoid `any`, use `unknown` if unsure.

### Styling & UI
- **Material 3**: Use M3 Expressive tokens and CSS custom properties (e.g., `var(--surface)`).
- **Responsive**: Split-pane layout for wide screens (≥ 840px), tabbed layout for narrow screens.
- **Icons**: Use Material Symbols via `MatIconModule`.

### Quiet Tech Constraints
- **Zero Network**: No runtime network calls after installation. No CDNs; all assets must be bundled.
- **No Telemetry**: No analytics or tracking scripts.
- **Performance**: No heavy background workers or battery-draining processes.

### Accessibility (A11y)
- **Compliance**: Must pass all AXE checks and follow WCAG AA minimums.
- **Focus**: Proper focus management and ARIA attributes for interactive elements.
