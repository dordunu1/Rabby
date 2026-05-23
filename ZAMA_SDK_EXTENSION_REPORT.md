# Using `@zama-fhe/sdk` 3.0 in Rabby Wallet (Chrome MV3 extension, Webpack build)

Hey — sharing what I ran into while integrating **`@zama-fhe/sdk` 3.0.0** + **`@zama-fhe/react-sdk` 3.0.0** (`RelayerWeb`) into **Rabby** (my Chrome MV3 wallet fork). Rabby is the only wallet/extension I have tested this on, so this report describes **what I had to do for Rabby specifically** — I am not claiming every MV3 extension will hit the same issues or need the same patches.

**Note — this is about the new SDK only:** My first Rabby implementation used the **older / low-level path** (custom REST relayer calls + viem, no in-browser FHE worker). That setup was **smooth** — I did not hit `computeStoreKey`, worker init, or MV3 CSP issues. Everything in this report applies to the **new `@zama-fhe/sdk` 3.x + `@zama-fhe/react-sdk` stack** (`RelayerWeb`, Web Worker + WASM inside the extension). I am not comparing the two approaches here beyond that context.

**Branch:** [`feat/zama-erc7984-support`](https://github.com/dordunu1/Rabby/tree/feat/zama-erc7984-support)

**Status (Rabby only):** Shield, unshield, confidential send, and decrypt work for me on Sepolia and Mainnet after the patches below.

**Environment**

- Rabby Chrome MV3 extension (popup UI)
- Production build: Webpack 5 + Terser minification ([`build/webpack.pro.config.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/build/webpack.pro.config.js))
- Packages: `@zama-fhe/sdk@3.0.0`, `@zama-fhe/react-sdk@3.0.0`, `@zama-fhe/relayer-sdk@0.4.x` ([`package.json`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/package.json))
- Relayer HTTP goes through my local proxy (`relayerUrl` → `/v2` API); that part is separate from the build issues below

---

## TL;DR — two patches I need for a working Rabby `dist/`

Without these, loading unpacked `dist/` in Chrome and trying shield / unshield / decrypt fails in Rabby.

| Step | Script | What breaks in Rabby without it |
|------|--------|-------------------------------|
| **Before** Webpack | [`scripts/setup-zama-fhe-extension.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/scripts/setup-zama-fhe-extension.js) | `computeStoreKey is not a function` (minified: `r.a.computeStoreKey is not a function`) when credentials / allow / decrypt run |
| **After** Webpack | [`scripts/patch-dist-zama-cdn.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/scripts/patch-dist-zama-cdn.js) | FHE worker init fails — bundled chunk still references `.umd.cjs`, which Chrome rejects in `importScripts` |

Both run automatically in my Rabby [`build:pro`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/package.json) pipeline (`postinstall` runs the setup script too).

---

## Issue 1 — `computeStoreKey is not a function` after Rabby prod build

**Symptom:** Rabby loads, Shield UI works, but the first crypto step (allow, decrypt, shield encrypt) throws:

```text
TypeError: r.a.computeStoreKey is not a function
```

(unminified: `computeStoreKey is not a function`)

**What I think is happening:** `@zama-fhe/sdk` ships **pre-minified ESM** where the credentials code calls something like `await e.computeStoreKey(...)`. Rabby’s Webpack + Terser pass rewrites the class binding in the final bundle so that static method reference breaks at runtime.

I also tried **disabling Terser mangle** for `@zama-fhe/*` in [`build/webpack.pro.config.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/build/webpack.pro.config.js) — that helped partially but was not enough on its own.

**What fixed it for Rabby:** patch `node_modules/@zama-fhe/sdk/dist/esm/index.js` **before** Webpack bundles it:

```diff
- await e.computeStoreKey
+ await this.constructor.computeStoreKey
```

That logic lives in [`scripts/setup-zama-fhe-extension.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/scripts/setup-zama-fhe-extension.js) and runs on `postinstall` and again right before `build:pro`. **If I skip this step and rebuild Rabby, I reliably hit the error again.**

---

## Issue 2 — FHE worker + MV3 CSP in Rabby (extension-local UMD, no `blob:`)

**Symptom (before fix):** “Failed to initialize FHE worker” / CSP violation on `blob:chrome-extension://…` inside `relayer-sdk.worker.js`.

**What I think is happening (in Rabby’s MV3 context):**

1. MV3 extensions cannot load remote scripts from `cdn.zama.org` in `script-src` (Chrome rejects adding that host to extension CSP).
2. The worker’s default web path does fetch → `blob:` → `importScripts(blob)`, which Rabby’s MV3 CSP blocks.
3. Dedicated extension workers often do not expose `chrome.runtime`, so the SDK’s extension detection branch does not always run — even when the main thread passes a `chrome-extension://…` URL.

**What fixed it for Rabby** (all in [`scripts/setup-zama-fhe-extension.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/scripts/setup-zama-fhe-extension.js)):

1. **Patch main SDK bundle** — point `cdnUrl` at packaged assets:
   `chrome.runtime.getURL("zama-fhe/relayer-sdk-js.umd.js")`
2. **Copy official assets** from `@zama-fhe/relayer-sdk/bundle` into Rabby’s extension bundle (`_raw/` → `dist/` via CopyPlugin):
   - `relayer-sdk.worker.js` (patched)
   - `zama-fhe/relayer-sdk-js.umd.js` (renamed from `.umd.cjs` — Chrome `importScripts` rejects `.cjs` MIME)
   - `tfhe_bg.wasm`, `kms_lib_bg.wasm`, `workerHelpers.js` at **dist root** (UMD resolves WASM from worker origin)
3. **Patch the worker** so `loadSdkScript` uses direct `importScripts(chrome-extension://…)` when the URL is extension-local — no blob fallback.

After a full Rabby prod build, [`scripts/verify-zama-dist.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/scripts/verify-zama-dist.js) checks those files exist and that the main chunk references `.umd.js`.

**Rabby SDK wiring (for context):**

| File | Role |
|------|------|
| [`src/ui/views/ZamaShield/ZamaSdkScope.tsx`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/src/ui/views/ZamaShield/ZamaSdkScope.tsx) | Wraps Shield UI in `ZamaProvider` + `RelayerWeb` |
| [`src/utils/zamaShield/createZamaRelayer.ts`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/src/utils/zamaShield/createZamaRelayer.ts) | `new RelayerWeb({ transports, relayerUrl })` |
| [`src/utils/zamaShield/rabbyViemClients.ts`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/src/utils/zamaShield/rabbyViemClients.ts) | Rabby wallet bridge + chain override for Shield tab |
| [`build/zama-webpack-resolve.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/build/zama-webpack-resolve.js) | Dedupe `@zama-fhe/sdk` in the Rabby bundle |

---

## Issue 3 — Rabby post-build chunk still had `.umd.cjs`

Even with the pre-build SDK patch, Rabby’s Webpack output chunk (`dist/232.js` in my build) sometimes still contained:

```js
chrome.runtime.getURL("zama-fhe/relayer-sdk-js.umd.cjs")
```

That breaks worker init for the same `.cjs` / MIME reason.

**What fixed it:** [`scripts/patch-dist-zama-cdn.js`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/scripts/patch-dist-zama-cdn.js) runs **after** Webpack and rewrites that string to `.umd.js`. When the chunk is already correct, it is a no-op.

So for Rabby right now — **both** the pre-build setup script and the post-build dist patch are required for a loadable extension.

---

## Rabby build flow that works for me

```text
postinstall  →  setup-zama-fhe-extension.js   (patch node_modules + copy _raw assets)
build:pro    →  setup-zama-fhe-extension.js
            →  webpack (prod)
            →  patch-dist-zama-cdn.js          (fix dist chunk if needed)
            →  verify-zama-dist.js             (smoke check)
```

Defined in [`package.json`](https://github.com/dordunu1/Rabby/blob/feat/zama-erc7984-support/package.json) (`postinstall` + `build:pro:default`).

Load unpacked `dist/` in Chrome → shield / unshield / send / decrypt all work in my Rabby build.

---

## Optional feedback for the SDK team

No pressure — things that would have made this Rabby integration easier without editing `node_modules`:

1. **Static method / bundler story** — guidance or a build that survives Webpack + Terser without the `computeStoreKey` rewrite.
2. **First-class MV3 extension path** — documented pattern for packaged UMD + WASM + worker, with worker `importScripts(chrome-extension://…)` when the URL is already extension-local (even without `chrome.runtime` in the worker).
3. **`.umd.js` vs `.umd.cjs`** — ship or document the `.js` variant for extension `importScripts`.

Happy to share more detail from my Rabby branch if useful.

---

*Last updated after confirming working Rabby flows on Sepolia and Mainnet — May 2026.*
