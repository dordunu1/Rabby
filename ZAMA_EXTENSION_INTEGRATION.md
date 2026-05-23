# Zama fhEVM in Rabby (MV3 extension)

Rabby3.0 uses **`@zama-fhe/react-sdk`** (`RelayerWeb` + browser FHE worker). This is **not** the same as the older branch that only called custom REST endpoints on Railway.

## What runs where

| Piece | Role |
|-------|------|
| **`relayer-sdk.worker.js`** | Web Worker started inside the extension; loads WASM crypto |
| **`zama-fhe/relayer-sdk-js.umd.cjs`** | UMD bundle copied from `@zama-fhe/relayer-sdk` (must live under extension `'self'`, not CDN) |
| **`tfhe_bg.wasm`**, **`kms_lib_bg.wasm`** (extension **root**) | UMD loads WASM from `/tfhe_bg.wasm` relative to the worker origin — **not** under `zama-fhe/` |
| **`relayer-web-proxy`** (`localhost:3001` or Railway) | HTTP API for Zama relayer **after** the worker is up (`/api/relayer/{chainId}/v2`) |

Proxy up on port 3001 does **not** fix “Failed to initialize FHE worker”. The worker must start first.

## One-time / automatic setup

```bash
node ./scripts/setup-zama-fhe-extension.js
```

Also runs on:

- **`npm install`** (`postinstall`)
- **`npm run build:pro`** (first step of `build:pro:default`)

It:

1. Patches `@zama-fhe/sdk` for Rabby’s webpack (`computeStoreKey`).
2. Patches SDK to use `chrome.runtime.getURL('zama-fhe/relayer-sdk-js.umd.cjs')` in extensions (MV3 forbids `https://cdn.zama.org` in manifest `script-src`).
3. Copies official files from `node_modules` into `_raw/` → webpack **CopyPlugin** → `dist/`.

You do **not** run a separate script before every dev save; re-run after `npm install` or SDK upgrades.

## Relayer URL

Edit `src/utils/zamaShield/createZamaRelayer.ts`:

```ts
const RELAYER_WEB_ORIGIN = 'http://localhost:3001'; // or https://your-proxy.up.railway.app
```

Rebuild and reload the extension in `chrome://extensions`.

## Known constraints (document for the team)

1. **`computeStoreKey` patch** — Rabby prod Terser + pre-minified SDK 3.0.0; track upstream/webpack fix.
2. **No CDN in manifest** — Chrome rejects remote `script-src`; we bundle UMD + WASM from npm.
3. **`integrityCheck: false`** — local UMD path does not match CDN SHA-384; acceptable for bundled same-origin script.
4. **Single-threaded FHE** — extensions do not get COOP/COEP; omit `threads` on `RelayerWeb`.

## Verify after build

- `dist/relayer-sdk.worker.js` exists
- `dist/zama-fhe/relayer-sdk-js.umd.cjs` exists
- `dist/tfhe_bg.wasm` and `dist/kms_lib_bg.wasm` exist at the **root** of `dist/` (required for WASM init)
- Manifest CSP is only `'self' 'wasm-unsafe-eval'` (no `cdn.zama.org`)

## Report upstream

- Zama: ship extension integration guide + optional `relayer-sdk.worker.js` in published `_raw` copy list
- Rabby: webpack plugin to apply patches without editing `node_modules`
