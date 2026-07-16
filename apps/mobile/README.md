# Noufex Mobile App (Phase 5)

> Expo SDK 51 (managed workflow) iOS + Android client.
> Shared types from `@noufex/shared`. Shared i18n strings with the
> web app. Talks to the same `/api/*` REST surface via the standard
> `noufex_auth` HttpOnly cookie + `Authorization: Bearer` fallback.

## Quick start

```bash
npm install --workspaces
cd apps/mobile
npm run start              # Expo Dev Tools
npm run ios                # open iOS simulator
npm run android            # open Android emulator
```

## Build for production

```bash
eas build --profile production --platform all
```

EAS will:
1. Run `npm ci --workspaces` at the repo root.
2. Pre-build the native `ios/` and `android/` directories.
3. Compile + sign with the appropriate credentials.

## Architecture

```
apps/mobile/
├── app.json             # Expo config
├── eas.json             # EAS Build profiles
├── tailwind.config.js   # NativeWind theme
├── tsconfig.json        # extends @noufex/typescript-config
└── src/
    ├── app/             # expo-router file-based routes
    │   ├── _layout.tsx       # root layout (providers)
    │   ├── (tabs)/           # bottom-tab routes
    │   │   ├── _layout.tsx
    │   │   ├── index.tsx     # home
    │   │   ├── categories.tsx
    │   │   ├── search.tsx
    │   │   ├── cart.tsx
    │   │   └── profile.tsx
    │   ├── auth/
    │   │   └── login.tsx
    │   ├── product/[id].tsx
    │   └── checkout.tsx
    ├── features/
    │   ├── auth/context/AuthContext.tsx
    │   ├── cart/context/CartContext.tsx
    │   └── home/api/home.ts
    ├── lib/api/client.ts       # fetch wrapper + ApiClientError
    └── i18n/
        ├── index.ts            # i18next init
        └── locales/{ar,en,zh}.json
```

## Shared code

The mobile app reuses:
- `@noufex/shared` — types + constants (Product, Order, etc.)
- The same i18n key namespace as the web app (`nav.home`, etc.)
- The same REST API surface (`/api/products`, `/api/cart`, …)

## Phase 5 status

- [x] Expo project skeleton + dependencies
- [x] Bottom-tab navigation
- [x] Auth + Cart contexts
- [x] i18n setup (ar/en/zh)
- [x] API client with CSRF + Bearer support
- [x] EAS Build profiles (preview + production)
- [ ] Push notifications (expo-notifications)
- [ ] Deep linking (expo-linking)
- [ ] Offline sync (TanStack Query persistence)
- [ ] App Store / Play Store metadata