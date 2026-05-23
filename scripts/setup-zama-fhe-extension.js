/**
 * Rabby MV3 + @zama-fhe/sdk 3.x integration setup (run on postinstall and before prod build).
 *
 * 1. Patch SDK bundle for Rabby webpack (computeStoreKey).
 * 2. Point RelayerWeb at extension-local relayer-sdk-js UMD (chrome.runtime.getURL).
 * 3. Copy official worker + UMD + WASM into _raw/ for CopyPlugin → dist/.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sdkEsm = path.join(root, 'node_modules/@zama-fhe/sdk/dist/esm/index.js');
const sdkWorker = path.join(
  root,
  'node_modules/@zama-fhe/sdk/dist/esm/relayer-sdk.worker.js'
);
const relayerBundleDir = path.join(
  root,
  'node_modules/@zama-fhe/relayer-sdk/bundle'
);
const rawDir = path.join(root, '_raw');
const zamaDir = path.join(rawDir, 'zama-fhe');
/** Chrome `importScripts` rejects `.cjs` (MIME application/octet-stream). */
const UMD_BUNDLE_FILE = 'relayer-sdk-js.umd.js';

if (!fs.existsSync(sdkEsm)) {
  console.warn('[rabby] @zama-fhe/sdk not installed — skip Zama extension setup');
  process.exit(0);
}

const sdkHeader = fs.readFileSync(sdkEsm);
if (sdkHeader.length < 100 || sdkHeader[0] === 0) {
  console.error(
    '[rabby] @zama-fhe/sdk dist/esm/index.js is missing or corrupted (null bytes).',
    'Remove node_modules/@zama-fhe/sdk and reinstall dependencies (yarn install), then re-run build:pro.'
  );
  process.exit(1);
}

// --- 1. computeStoreKey (webpack + Terser) ---
const computeFrom = 'await e.computeStoreKey';
const computeTo = 'await this.constructor.computeStoreKey';
let sdkSource = fs.readFileSync(sdkEsm, 'utf8');

if (sdkSource.includes(computeFrom)) {
  sdkSource = sdkSource.split(computeFrom).join(computeTo);
  fs.writeFileSync(sdkEsm, sdkSource);
  console.log('[rabby] patched @zama-fhe/sdk computeStoreKey');
} else if (!sdkSource.includes(computeTo)) {
  console.warn('[rabby] computeStoreKey patch pattern not found');
}

// --- 2. extension-local UMD instead of cdn.zama.org (MV3 blocks remote script-src) ---
const cdnDefault =
  'cdnUrl:`https://cdn.zama.org/relayer-sdk-js/0.4.2/relayer-sdk-js.umd.cjs`';
const cdnExtension = `cdnUrl:(typeof chrome<"u"&&chrome.runtime?.getURL?chrome.runtime.getURL("zama-fhe/${UMD_BUNDLE_FILE}"):\`https://cdn.zama.org/relayer-sdk-js/0.4.2/relayer-sdk-js.umd.cjs\`)`;

sdkSource = fs.readFileSync(sdkEsm, 'utf8');
if (sdkSource.includes(cdnDefault)) {
  sdkSource = sdkSource.split(cdnDefault).join(cdnExtension);
  fs.writeFileSync(sdkEsm, sdkSource);
  console.log('[rabby] patched @zama-fhe/sdk cdnUrl for extension');
} else {
  sdkSource = sdkSource
    .split('zama-fhe/relayer-sdk-js.umd.cjs')
    .join(`zama-fhe/${UMD_BUNDLE_FILE}`);
  fs.writeFileSync(sdkEsm, sdkSource);
  if (sdkSource.includes(`zama-fhe/${UMD_BUNDLE_FILE}`)) {
    console.log('[rabby] updated @zama-fhe/sdk cdnUrl to .umd.js');
  }
}

// --- 3. copy assets from npm (official files, not hand-written) ---
function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(sdkWorker)) {
  console.warn('[rabby] missing @zama-fhe/sdk relayer-sdk.worker.js');
  process.exit(1);
}

let workerSource = fs.readFileSync(sdkWorker, 'utf8');
const validateNeedle = `if (url.protocol !== "https:") throw new Error("CDN URL must use https");`;
const validatePatch = `if (url.protocol === "chrome-extension:" && (url.pathname.endsWith("relayer-sdk-js.umd.js") || url.pathname.endsWith("relayer-sdk-js.umd.cjs"))) return url.toString();
		if (url.protocol !== "https:") throw new Error("CDN URL must use https");`;
if (workerSource.includes(validateNeedle) && !workerSource.includes('chrome-extension:')) {
  workerSource = workerSource.replace(validateNeedle, validatePatch);
}

// MV3 dedicated workers often lack `chrome.runtime`; main thread still passes
// chrome-extension://…/zama-fhe/relayer-sdk-js.umd.js (.js MIME for importScripts). No blob: (CSP).
const loadSdkNeedle = `async function loadSdkScript(cdnUrl, integrity) {
		const validatedUrl = validateCdnUrl(cdnUrl);
		if (getBrowserExtensionRuntime()) {`;
const loadSdkPatch = `async function loadSdkScript(cdnUrl, integrity) {
		const validatedUrl = validateCdnUrl(cdnUrl);
		if (validatedUrl.startsWith("chrome-extension:")) {
			return self.importScripts(validatedUrl);
		}
		if (getBrowserExtensionRuntime()) {`;
if (!workerSource.includes('validatedUrl.startsWith("chrome-extension:")')) {
  if (workerSource.includes(loadSdkNeedle)) {
    workerSource = workerSource.replace(loadSdkNeedle, loadSdkPatch);
  } else {
    console.warn('[rabby] worker loadSdkScript patch pattern not found');
  }
  console.log('[rabby] patched worker loadSdkScript for chrome-extension:// (no blob)');
}

fs.writeFileSync(path.join(rawDir, 'relayer-sdk.worker.js'), workerSource);

const umdSource = path.join(relayerBundleDir, 'relayer-sdk-js.umd.cjs');
if (!fs.existsSync(umdSource)) {
  console.warn(`[rabby] missing ${umdSource}`);
  process.exit(1);
}
copyFile(umdSource, path.join(zamaDir, UMD_BUNDLE_FILE));

for (const name of ['kms_lib_bg.wasm', 'tfhe_bg.wasm']) {
  const from = path.join(relayerBundleDir, name);
  if (!fs.existsSync(from)) {
    console.warn(`[rabby] missing ${from}`);
    process.exit(1);
  }
  copyFile(from, path.join(zamaDir, name));
}

// UMD loads these from extension root (`/tfhe_bg.wasm`, `/workerHelpers.js`), not under `zama-fhe/`.
for (const rootAsset of ['kms_lib_bg.wasm', 'tfhe_bg.wasm', 'workerHelpers.js']) {
  const from = path.join(relayerBundleDir, rootAsset);
  if (!fs.existsSync(from)) {
    console.warn(`[rabby] missing ${from}`);
    process.exit(1);
  }
  copyFile(from, path.join(rawDir, rootAsset));
}

console.log(
  '[rabby] Zama extension assets ready (_raw: worker, wasm, workerHelpers + zama-fhe/umd.js)'
);
