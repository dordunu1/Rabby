# Zama ERC-7984 in Rabby 3.0 — extension integration map

This document lists **every file and touchpoint** that makes confidential (ERC-7984 / fhEVM) work inside the **Rabby 3.0** Chrome MV3 extension. It mirrors the role of [meta3.0/ZAMA-ERC7984-IMPLEMENTATION.md](../meta3.0/ZAMA-ERC7984-IMPLEMENTATION.md) for MetaMask.

For **Webpack / MV3 build fixes** (`computeStoreKey`, UMD path, worker CSP), see **[ZAMA_SDK_EXTENSION_REPORT.md](./ZAMA_SDK_EXTENSION_REPORT.md)**.

All paths below are relative to **`Rabby3.0/`** (branch `feat/zama-erc7984-support`).

---

## Architecture (high level)

```
Dashboard “Shield” tile / Desktop “Shielded” tab
  └─ /zama-shield route
       └─ ZamaSdkScope (ZamaProvider + React Query)
            ├─ RelayerWeb → relayer-web-proxy /api/relayer/{chainId}/v2
            ├─ ViemSigner → Rabby wallet bridge (eth_sendTransaction, eth_signTypedData_v4, eth_call)
            ├─ indexedDBStorage — FHE keypair + decrypted balance cache
            └─ IndexedDB session store — wallet decrypt session (MV3 popup survival)
```

Packaged extension assets (not in `src/`):

- **`_raw/relayer-sdk.worker.js`** + root **`tfhe_bg.wasm`**, **`kms_lib_bg.wasm`**, **`workerHelpers.js`** → copied to **`dist/`** root (worker origin)
- **`_raw/zama-fhe/relayer-sdk-js.umd.js`** → **`dist/zama-fhe/`** (loaded via `chrome.runtime.getURL`)

---

## New: `src/utils/zamaShield/` (SDK + registry layer)

| File | Role |
| --- | --- |
| [zamaImports.ts](./src/utils/zamaShield/zamaImports.ts) | Single webpack import surface for `@zama-fhe/react-sdk` + `ViemSigner` (avoids duplicate SDK bundles) |
| [createZamaRelayer.ts](./src/utils/zamaShield/createZamaRelayer.ts) | `RelayerWeb` factory; `RELAYER_WEB_ORIGIN` (default `http://localhost:3001` proxy) |
| [zamaShieldConfig.ts](./src/utils/zamaShield/zamaShieldConfig.ts) | Relayer proxy origin / env helpers |
| [rabbyViemClients.ts](./src/utils/zamaShield/rabbyViemClients.ts) | Rabby ↔ viem bridge for `ViemSigner` (`eth_sendTransaction`, provider reads) |
| [rpc.ts](./src/utils/zamaShield/rpc.ts) | Public viem read clients (mainnet / Sepolia) |
| [zamaShieldChain.ts](./src/utils/zamaShield/zamaShieldChain.ts) | Supported chain IDs + display names for Shield UI |
| [constants.ts](./src/utils/zamaShield/constants.ts) | Chain IDs, `CONFIDENTIAL_ZERO_HANDLE`, shared constants |
| [registry.ts](./src/utils/zamaShield/registry.ts) | Per-chain confidential wrapper token definitions |
| [abi.ts](./src/utils/zamaShield/abi.ts) | Minimal ABI fragments for reads and legacy helpers |
| [checksumAddress.ts](./src/utils/zamaShield/checksumAddress.ts) | Address normalization |
| [zamaErrors.ts](./src/utils/zamaShield/zamaErrors.ts) | User-facing error strings |
| [unwrapReceipt.ts](./src/utils/zamaShield/unwrapReceipt.ts) | Parses `UnwrapRequested` log from receipt (resume / debug) |

---

## New: `src/ui/views/ZamaShield/` (popup page + shared list)

| File | Role |
| --- | --- |
| [ZamaSdkScope.tsx](./src/ui/views/ZamaShield/ZamaSdkScope.tsx) | `ZamaProvider` + `QueryClientProvider`; `indexedDBStorage` + wallet session IndexedDB |
| [index.tsx](./src/ui/views/ZamaShield/index.tsx) | Popup page at `/zama-shield`; chain switcher; wraps `ShieldList` |
| [ShieldList.tsx](./src/ui/views/ZamaShield/ShieldList.tsx) | Shared token list (popup + desktop); row actions for wrap / unwrap / send / decrypt |
| [useZamaShield.ts](./src/ui/views/ZamaShield/useZamaShield.ts) | Business hooks: `useShield`, `useUnwrap`, `useConfidentialTransfer`, balances, allow, resume unshield |
| [useTokenLogo.ts](./src/ui/views/ZamaShield/useTokenLogo.ts) | Debank / CoinGecko logo resolution + cache |
| [TokenLogo.tsx](./src/ui/views/ZamaShield/TokenLogo.tsx) | Logo + shield-lock badge |
| [WrapModal.tsx](./src/ui/views/ZamaShield/WrapModal.tsx) | Approve + shield flow |
| [UnwrapModal.tsx](./src/ui/views/ZamaShield/UnwrapModal.tsx) | 3-step unwrap milestone UI (encrypt → confirm → decrypt → finalize) |
| [SendModal.tsx](./src/ui/views/ZamaShield/SendModal.tsx) | Confidential transfer |
| [ZamaShieldNetworkHint.tsx](./src/ui/views/ZamaShield/ZamaShieldNetworkHint.tsx) | Unsupported-chain / register Sepolia hints |

---

## New: desktop Shielded tab

| File | Role |
| --- | --- |
| [ShieldedTabPane/index.tsx](./src/ui/views/DesktopProfile/components/ShieldedTabPane/index.tsx) | **Shielded** tab in expanded account view; reuses `ShieldList` with `layout="desktop"` |

---

## New: dashboard asset

| File | Role |
| --- | --- |
| [shield-cc.svg](./src/ui/assets/dashboard/panel/shield-cc.svg) | Shield tile icon on home dashboard |

---

## Build scripts & webpack (required for MV3 + SDK 3.x)

| File | Role |
| --- | --- |
| [scripts/setup-zama-fhe-extension.js](./scripts/setup-zama-fhe-extension.js) | Patches `@zama-fhe/sdk` in `node_modules`; copies worker / UMD / WASM into `_raw/`; fixes worker `importScripts` for extension URLs. Runs on **`postinstall`** and start of **`build:pro`**. |
| [scripts/patch-dist-zama-cdn.js](./scripts/patch-dist-zama-cdn.js) | Post-webpack rewrite `.umd.cjs` → `.umd.js` in `dist/` chunks if needed |
| [scripts/verify-zama-dist.js](./scripts/verify-zama-dist.js) | Smoke-check `dist/` after prod build |
| [build/zama-webpack-resolve.js](./build/zama-webpack-resolve.js) | Webpack alias so one copy of `@zama-fhe/sdk` is bundled |

`package.json` wires: `"postinstall": "patch-package && node ./scripts/setup-zama-fhe-extension.js"` and `build:pro:default` runs setup → webpack → patch-dist → verify.

---

## Packaged assets (`_raw/` → `dist/`)

| Path after setup | In `dist/` | Runtime use |
| --- | --- | --- |
| `_raw/relayer-sdk.worker.js` | `relayer-sdk.worker.js` (root) | FHE Web Worker |
| `_raw/tfhe_bg.wasm`, `_raw/kms_lib_bg.wasm`, `_raw/workerHelpers.js` | Same names at **dist root** | WASM loaded relative to worker origin |
| `_raw/zama-fhe/relayer-sdk-js.umd.js` | `zama-fhe/relayer-sdk-js.umd.js` | `RelayerWeb` UMD (`chrome.runtime.getURL`) |

Do **not** rely on `cdn.zama.org` in extension CSP.

---

## Integration touchpoints (modified upstream Rabby files)

| File | Role |
| --- | --- |
| [src/ui/views/Dashboard/components/DashboardPanel/index.tsx](./src/ui/views/Dashboard/components/DashboardPanel/index.tsx) | **Shield** dashboard tile → `history.push('/zama-shield')` |
| [src/ui/views/MainRoute.tsx](./src/ui/views/MainRoute.tsx) | `PrivateRoute` for `/zama-shield` → `ZamaShield` page |
| [src/ui/views/DesktopProfile/index.tsx](./src/ui/views/DesktopProfile/index.tsx) | **Shielded** tab → `ShieldedTabPane` |
| [_raw/locales/en/messages.json](./_raw/locales/en/messages.json) | `page.zamaShield.*`, `page.desktopProfile.tabs.shielded` strings |
| [package.json](./package.json) | `@zama-fhe/sdk`, `@zama-fhe/react-sdk`, `@zama-fhe/relayer-sdk`; build script hooks |

Webpack prod config may include Terser exceptions for `@zama-fhe/*` — see **ZAMA_SDK_EXTENSION_REPORT.md**.

---

## Dependencies (`package.json`)

- `@zama-fhe/sdk@^3.0.0`
- `@zama-fhe/react-sdk@^3.0.0`
- `@zama-fhe/relayer-sdk@0.4.3` (worker + UMD + WASM source in `node_modules`)
- `@tanstack/react-query` (via `ZamaSdkScope`)

---

## Local dev

1. Start [relayer-web-proxy](../relayer-web-proxy/) (default `http://localhost:3001`).
2. Set origin in [createZamaRelayer.ts](./src/utils/zamaShield/createZamaRelayer.ts) if the proxy runs elsewhere.
3. `npm install` (runs Zama setup) then `npm run build:pro`.
4. Load unpacked **`dist/`** in `chrome://extensions`.
5. Register **Sepolia** under Settings → custom network if testing Sepolia txs (Rabby `findChain` validation).

---

## User flows (where to look in code)

| Flow | Primary files |
| --- | --- |
| Shield (wrap) | `WrapModal.tsx`, `useZamaShield.ts` → `useShield` |
| Unshield (unwrap) | `UnwrapModal.tsx`, `useZamaShield.ts` → `useUnshield` / `useResumeUnshield` |
| Confidential send | `SendModal.tsx` → `useConfidentialTransfer` |
| Decrypt balance | `ShieldList.tsx`, `useZamaShield.ts` → SDK decrypt hooks |
| Popup + desktop list | `ShieldList.tsx` (shared) |

Cleartext balances live in **SDK IndexedDB** (`indexedDBStorage`), not Rabby `chrome.storage.local`.

---

## Removed / legacy (do not restore for SDK 3.x path)

The first Rabby branch used hand-rolled REST in `relayer.ts`. The current stack uses **`RelayerWeb`** only. Do not re-add parallel REST encrypt/decrypt helpers unless intentionally maintaining two stacks.

| Legacy (old branch) | Replaced by |
| --- | --- |
| `src/utils/zamaShield/relayer.ts` | `RelayerWeb` + proxy `/v2` API |
| Direct relayer API keys in extension | `relayer-web-proxy` server-side auth |

---

## Related docs

| Document | Purpose |
| --- | --- |
| [ZAMA_SDK_EXTENSION_REPORT.md](./ZAMA_SDK_EXTENSION_REPORT.md) | Rabby-specific Webpack / MV3 issues and fixes |
| [../rabby.md](../rabby.md) | Older REST-era file map (Cusdt repo root); historical reference |
| [../meta3.0/ZAMA-ERC7984-IMPLEMENTATION.md](../meta3.0/ZAMA-ERC7984-IMPLEMENTATION.md) | Parallel map for MetaMask fork |

---

*Last updated: May 2026 — Rabby 3.0 `feat/zama-erc7984-support`.*
