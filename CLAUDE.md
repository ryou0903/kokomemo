# CLAUDE.md - KokoMemo (ここメモ)

## Project Overview

KokoMemo is a Japanese PWA for elderly users (シルバー世代) that simplifies saving locations and navigating to them via Google Maps. All UI text is in Japanese. It is deployed to GitHub Pages at `/kokomemo/`.

## Tech Stack

- **Framework:** React 19 + TypeScript 5.9
- **Build:** Vite 7
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite`)
- **Routing:** React Router DOM 7
- **PWA:** vite-plugin-pwa (Workbox service worker)
- **APIs:** Google Maps Platform (Maps, Places, Geocoding), Gemini API (typo correction)
- **Storage:** localStorage only (no backend/database)
- **Date utils:** date-fns
- **IDs:** uuid

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Generate icons + tsc type-check + Vite build
npm run build:icons # Generate PNG icons from SVG (uses sharp)
npm run lint       # ESLint (TypeScript + React rules)
npm run preview    # Preview production build
```

There is **no test framework** configured. No unit or integration tests exist.

## Project Structure

```
src/
├── App.tsx                     # Route definitions (React Router)
├── main.tsx                    # Entry point
├── index.css                   # Global styles + Tailwind + custom theme
├── components/
│   ├── layout/Header.tsx       # Sticky header with back navigation
│   ├── ui/                     # Reusable UI primitives (Button, Card, Input, etc.)
│   │   └── index.ts            # Barrel exports
│   ├── PlaceCard.tsx           # Place display with nav/edit actions
│   ├── SearchBar.tsx           # Search with autocomplete
│   ├── SortSelect.tsx          # Sort dropdown
│   └── InteractiveMap.tsx      # Google Maps with drag/pin/long-press
├── pages/
│   ├── HomePage.tsx            # Main list view with tab filtering
│   ├── PlacePage.tsx           # Add/edit place
│   ├── SearchPage.tsx          # Search + interactive map
│   ├── CalendarPage.tsx        # Calendar view of places
│   ├── SettingsPage.tsx        # Travel mode preferences
│   └── TabsPage.tsx            # Manage custom categories
├── contexts/
│   └── ToastContext.tsx         # Toast notification system
├── hooks/
│   └── useGoogleMaps.ts        # Google Maps API loader + Places services
├── lib/
│   ├── storage.ts              # localStorage CRUD (places, tabs, history, settings)
│   └── maps.ts                 # Google Maps API integration (geocoding, places, nav)
└── types/
    └── index.ts                # All TypeScript interfaces and constants
```

### Key Config Files

- `vite.config.ts` — Build config, PWA manifest, Workbox caching, base path `/kokomemo/`
- `tsconfig.app.json` — App TypeScript config (ES2022, strict, React JSX)
- `eslint.config.js` — ESLint with TS, React Hooks, React Refresh plugins
- `.env.example` — Required env vars template
- `.github/workflows/deploy.yml` — CI/CD to GitHub Pages (Node 20, `npm ci && npm run build`)
- `scripts/generate-icons.mjs` — SVG to PNG icon generation (sharp)

## Routes

| Path | Page | Purpose |
|------|------|---------|
| `/` | HomePage | List places with tab filtering and sorting |
| `/place/new` | PlacePage | Register a new place |
| `/place/:id` | PlacePage | Edit an existing place |
| `/search` | SearchPage | Search places + interactive map |
| `/calendar` | CalendarPage | Monthly calendar view |
| `/settings` | SettingsPage | Travel mode settings |
| `/settings/tabs` | TabsPage | Manage custom categories |

## Data Models

All data lives in localStorage under keys prefixed with `kokomemo_`.

- **Place:** `{ id, name, memo, address, postalCode?, phoneNumber?, latitude, longitude, tabId, createdAt, updatedAt }`
- **Tab:** `{ id, name, isCustom, order }` — 9 defaults + up to 5 custom tabs
- **SearchHistory:** `{ query, placeId?, timestamp }` — capped at 20 entries
- **AppSettings:** `{ travelMode: 'driving' | 'transit' | 'walking' }`

## Environment Variables

```
VITE_GOOGLE_MAPS_API_KEY=   # Required - Google Maps Platform API key
VITE_GEMINI_API_KEY=         # Optional - Gemini API for typo correction
```

These are injected at build time via Vite. In CI, they come from GitHub Actions secrets.

## Design Conventions

### Accessibility for Elderly Users
- **Large fonts:** 20px base, 30px titles
- **Large touch targets:** minimum 56px (3.5rem)
- **High contrast** color scheme with blue primary
- **Simple navigation** with clear back buttons and icons
- Background color: `#fffbf5` (light cream)

### Styling
- Tailwind CSS utility classes throughout
- Custom CSS variables defined in `src/index.css`
- Glass morphism effects on buttons (backdrop blur)
- Focus visible: 3px outline for keyboard navigation

### State Management
- React Context: `ToastContext` for notifications
- localStorage: all persistent data via `src/lib/storage.ts`
- Component-local `useState` for UI state
- `useRef` for mutable values (map instances, timers)

### Code Patterns
- All UI components accept standard HTML attributes via `React.ComponentProps`
- Button component has variants: `primary | secondary | danger | ghost`
- Barrel exports from `src/components/ui/index.ts`
- Google Maps integration uses both new (AdvancedMarkerElement) and legacy (Marker) APIs with fallback
- Places API has REST v1 fallback for older devices
- UUIDs generated via `uuid` package for all entities

## Deployment

- **Target:** GitHub Pages at `https://ryou0903.github.io/kokomemo/`
- **Trigger:** Push to `main` branch or manual dispatch
- **Pipeline:** `.github/workflows/deploy.yml` — install, build, deploy
- **Base path:** All assets served under `/kokomemo/` prefix

## Important Notes

- All user-facing text is in Japanese — maintain this convention
- No backend server; everything is client-side with localStorage
- Google Maps API key is loaded at runtime via `<script>` tag callback
- PWA service worker caches Google Maps tile requests (CacheFirst, 1 week, max 50)
- Mobile-first design with `user-scalable=no` viewport setting
- The `dist/` directory is gitignored and built fresh each deployment
