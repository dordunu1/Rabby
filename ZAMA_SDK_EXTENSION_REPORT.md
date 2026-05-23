# Zama SDK 3.x in Rabby MV3 — integration report

**Branch / app:** `Rabby3.0` (Chrome MV3 extension)  
**Goal:** Shield / Unshield / Send using `@zama-fhe/react-sdk` + `RelayerWeb` (same direction as Confidential-safe / `md-files`).  
**Status:** **Not production-ready.** FHE worker does not initialize; user-facing error: **“Failed to initialize FHE worker”** / **“Configuration error”**.

This document is for the Rabby team: what we built, what breaks, and why it is harder than the older REST-based Shield on `feat/zama-erc7984-support`.

---

## 1. Two different architectures (why the old branch “just worked”)

| | **Older Rabby (`Rabby`, REST)** | **Rabby3.0 (`@zama-fhe/react-sdk`)** |
|--|----------------------------------|--------------------------------------|
| Crypto | Server-side via **custom REST** on Railway | **In-extension** Web Worker + WASM (`RelayerWeb`) |
| Extension calls | `fetch` → `/api/encrypt-amount`, `/api/user-decrypt/prepare`, etc. | `RelayerWeb` → worker `INIT` → `initSDK` → encrypt/decrypt in worker |
| FHE worker in popup | **No** | **Yes** — required before decrypt/shield/unshield |
| Key files | `src/utils/zamaShield/relayer.ts`, `useZamaShield.ts` (viem + `eth_sendTransaction`) | `ZamaSdkScope.tsx`, `createZamaRelayer.ts`, hooks from `zamaImports.ts` |

The **relayer-web-proxy** on port **3001** only forwards Zama’s **HTTP `/v2` relayer API**. It does **not** replace the in-browser FHE worker. Proxy being “live” does not fix worker init.

---

## 2. Stack we integrated (names the team will see in code / console)

**Packages**

- `@zama-fhe/sdk` **3.0.0** — `RelayerWeb`, `ZamaSDK`, `ViemSigner`, `indexedDBStorage`, `chromeSessionStorage`
- `@zama-fhe/react-sdk` — `ZamaProvider`, React Query hooks

**Rabby wiring**

| File | Role |
|------|------|
| `src/ui/views/ZamaShield/ZamaSdkScope.tsx` | Wraps Shield UI in `ZamaProvider` + `createZamaRelayer()` |
| `src/utils/zamaShield/createZamaRelayer.ts` | `new RelayerWeb({ transports, relayerUrl → proxy })` |
| `src/utils/zamaShield/zamaImports.ts` | Re-exports SDK / react-sdk for one import path |
| `src/ui/views/ZamaShield/useZamaShield.ts` | `useAllow`, `useShield`, `useUnshield`, `useConfidentialTransfer`, `useConfidentialBalances`, etc. |
| `build/zama-webpack-resolve.js` | Single copy of `@zama-fhe/sdk` in bundle (dedupe) |
| `build/webpack.pro.config.js` | Terser: no mangle on `@zama-fhe/*` (partial mitigation) |

**Typical call chain when user taps “Decrypt all”** (from console stack):

1. `useAllow` → `allow` / `allowContracts` (`@zama-fhe/react-sdk`)
2. `ZamaSDK` → `resolveCredentials` → `createCredentials` → **`generateKeypair`**
3. `RelayerWeb` → `#ensureWorker` → **`initWorker`**
4. Worker `INIT` → `loadSdkScript` → **`initSDK`** (WASM)
5. On failure → `ConfigurationError` / UI: **“Failed to initialize FHE worker”**

Shield/unshield that need encryption hit the same worker path (`encrypt`, `userDecrypt`, etc.).

---

## 3. Issue A — `computeStoreKey` / Webpack + Terser (patched)

**Symptom (production build):**  
`computeStoreKey is not a function` (minified: `a.a.computeStoreKey is not a function` / `r.a.computeStoreKey`).

**Cause:**  
`@zama-fhe/sdk` 3.0.0 ships **pre-minified** ESM (`class e` + static `e.computeStoreKey`). Rabby’s **production Webpack + Terser** rewrites the class binding so instance code calls a broken reference.

**Mitigation (local, not upstream):**

- Script: `scripts/setup-zama-fhe-extension.js` (and legacy alias `scripts/patch-zama-sdk-computeStoreKey.js`)
- Patches `node_modules/@zama-fhe/sdk/dist/esm/index.js`:  
  `await e.computeStoreKey` → `await this.constructor.computeStoreKey`
- Runs on **`postinstall`** and before **`npm run build:pro`**

**Team note:** This is a **bundler + SDK packaging** interaction. Prefer upstream fix or a Webpack rule that preserves static methods on `@zama-fhe/sdk` without editing `node_modules`.

---

## 4. Issue B — FHE worker never reaches “ready” (current blocker)

**Symptom:**  
Toast / modal: **“Failed to initialize FHE worker”**; unshield modal: **“Configuration error: Failed to initialize FHE worker”**; shield may fail after approve with **“Shield transaction failed”** if encrypt never ran.

**Observed in DevTools (popup console):**

```text
Loading the script 'blob:chrome-extension://…/e4f69b3e-…' violates the following
Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval' …"

[Worker] Init error: Failed to execute 'importScripts' on 'WorkerGlobalScope':
The script at 'blob:chrome-extension://…' failed to load.
```

**What this means (root cause):**

1. `relayer-sdk.worker.js` **does start** (file under `dist/`).
2. On `INIT`, the worker runs `loadSdkScript(cdnUrl, integrity)` from `@zama-fhe/sdk`.
3. In **browser extensions**, the SDK is supposed to use **`importScripts(https://…)`** or **`importScripts(chrome-extension://…/zama-fhe/relayer-sdk-js.umd.cjs)`** when `getBrowserExtensionRuntime()` is detected.
4. In our run, the worker took the **web fallback**: **fetch UMD → `blob:` URL → `importScripts(blob)`**.
5. Chrome MV3 **blocks `blob:`** under `script-src 'self' 'wasm-unsafe-eval'` → WASM never loads → **`initSDK` fails** → “FHE worker” error.

So the failure is **not** “proxy on 3001 down” and **not** “forgot to run patch before build” alone — it is **CSP + wrong script-loading path inside the worker**.

**Why `cdn.zama.org` in manifest was rejected:**  
Chrome does not allow remote hosts in `extension_pages` `script-src`. Loading the extension failed with:  
`Insecure CSP value "https://cdn.zama.org" in directive 'script-src'`.

---

## 5. Workarounds we tried (extension asset copy)

Scripts / docs added under `Rabby3.0`:

| Artifact | Purpose |
|----------|---------|
| `scripts/setup-zama-fhe-extension.js` | Patch SDK + copy `relayer-sdk.worker.js`, `zama-fhe/relayer-sdk-js.umd.cjs`, WASM into `_raw/` → `dist/` |
| `scripts/verify-zama-dist.js` | Post-build check that files exist |
| `ZAMA_EXTENSION_INTEGRATION.md` | Short dev notes |

**Intended layout in `dist/`:**

- `relayer-sdk.worker.js`
- `zama-fhe/relayer-sdk-js.umd.cjs`
- `tfhe_bg.wasm`, `kms_lib_bg.wasm` at **`dist/` root** (UMD resolves `/tfhe_bg.wasm` from worker origin, not under `zama-fhe/`)

**Patch in SDK (node_modules):**  
`cdnUrl` → `chrome.runtime.getURL("zama-fhe/relayer-sdk-js.umd.cjs")` when `chrome.runtime` exists (in main bundle `dist/232.js` this patch **is** present).

**Fix applied (Rabby3.0):**  
`setup-zama-fhe-extension.js` patches the worker so if `cdnUrl` is `chrome-extension://…`, it calls **`importScripts(validatedUrl)`** directly (no `blob:`). Dedicated extension workers often lack `chrome.runtime`, so the SDK’s `getBrowserExtensionRuntime()` branch never ran. Re-run setup / rebuild and reload `dist/`.

---

## 6. Relayer URL vs worker (common confusion)

| Step | Needs port 3001 / Railway proxy? |
|------|----------------------------------|
| Start FHE worker + load WASM | **No** |
| `useAllow` / `generateKeypair` / encrypt / decrypt in worker | **No** (local WASM) |
| Relayer HTTP (`relayerUrl` … `/api/relayer/{chainId}/v2`) | **Yes** — after worker is healthy |

`createZamaRelayer.ts` points `relayerUrl` at e.g. `http://localhost:3001/api/relayer/11155111/v2` (or deployed proxy). That is correct for **RelayerWeb** but **downstream** of worker init.

---

## 7. Errors summary (for tickets / Slack)

| User-visible | Likely SDK / layer | When |
|--------------|-------------------|------|
| `computeStoreKey is not a function` | `CredentialsManager` / storage key | After prod build, allow/decrypt (mitigated by patch) |
| `Failed to initialize FHE worker` | `RelayerWeb` / `ConfigurationError` | Decrypt all, unshield encrypt step, first credential create |
| CSP: `blob:chrome-extension://…` blocked | Worker `loadSdkScript` | Worker `INIT` (current root cause in console) |
| `Shield transaction reverted` | On-chain `shield` tx | Separate from worker; may occur if encrypt path partially ran or contract/gas/approval |
| Extension won’t load | Manifest CSP | If `https://cdn.zama.org` added to `script-src` |

---

## 8. Recommendations for the team

**Short term (unblock Shield in extension)**

1. **Confirm with Zama** official MV3 pattern for `RelayerWeb` — worker must not use `blob:` in extensions; document required `chrome.runtime.getURL` + packaged UMD/WASM.
2. **Or** keep **REST + server-side FHE** (proven on `Rabby` branch) until SDK/extension story is first-class.
3. Do **not** add `cdn.zama.org` to manifest CSP (Chrome rejects it).

**Medium term (if staying on SDK 3.x)**

- Remove `node_modules` patches; replace with Webpack plugin or forked SDK build.
- Ensure worker always uses **packaged** `importScripts(extensionUrl)` and WASM at paths the UMD expects.
- Add a single CI step: load unpacked `dist/` in headless Chrome and assert worker `INIT` succeeds (smoke test).

**Dependencies to track**

- `@zama-fhe/sdk` **3.0.0**
- `@zama-fhe/relayer-sdk` **0.4.x** (bundled UMD + `tfhe_bg.wasm` / `kms_lib_bg.wasm`)
- Docs: `md-files/reference/sdk/RelayerWeb.md`, `md-files/guides/web-extensions.md`

---

## 9. What to tell stakeholders in one sentence

We integrated Zama’s **new in-browser FHE worker** (`RelayerWeb`) into Rabby MV3; Chrome’s extension CSP blocks the worker’s **blob** script loader, so WASM never initializes, while our **older Shield** used **simple REST calls** to a hosted relayer with no worker — that is why the new path is blocked even when the local proxy on port 3001 is running.

---

*Report generated from Rabby3.0 integration work and console evidence (CSP `blob:chrome-extension://…` on `relayer-sdk.worker.js`).*
