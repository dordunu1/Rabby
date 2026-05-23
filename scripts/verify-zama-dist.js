const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '../dist');
const required = [
  'relayer-sdk.worker.js',
  'zama-fhe/relayer-sdk-js.umd.js',
  'tfhe_bg.wasm',
  'kms_lib_bg.wasm',
  'workerHelpers.js',
];

let ok = true;
for (const rel of required) {
  const p = path.join(dist, rel);
  if (!fs.existsSync(p)) {
    console.error(`[rabby] MISSING dist/${rel}`);
    ok = false;
  } else {
    console.log(`[rabby] OK dist/${rel} (${fs.statSync(p).size} bytes)`);
  }
}

const chunk = path.join(dist, '232.js');
if (fs.existsSync(chunk)) {
  const s = fs.readFileSync(chunk, 'utf8');
  const hasExtCdn = s.includes('chrome.runtime.getURL("zama-fhe/relayer-sdk-js.umd.js")');
  console.log(`[rabby] 232.js extension cdnUrl patch: ${hasExtCdn ? 'OK' : 'MISSING'}`);
  if (!hasExtCdn) ok = false;
}

process.exit(ok ? 0 : 1);
