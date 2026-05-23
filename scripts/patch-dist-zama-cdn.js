/**
 * Hotfix built chunk after setup changes UMD path to .js (avoids full rebuild for a quick test).
 * `npm run build:pro` bakes the correct URL; run this only when dist/232.js still has .umd.cjs.
 */
const fs = require('fs');
const path = require('path');

const chunk = path.join(__dirname, '../dist/232.js');
if (!fs.existsSync(chunk)) {
  console.warn('[rabby] dist/232.js not found — run build:pro first');
  process.exit(0);
}

let s = fs.readFileSync(chunk, 'utf8');
const from = 'chrome.runtime.getURL("zama-fhe/relayer-sdk-js.umd.cjs")';
const to = 'chrome.runtime.getURL("zama-fhe/relayer-sdk-js.umd.js")';
if (!s.includes(from)) {
  if (s.includes(to)) {
    console.log('[rabby] dist/232.js already uses .umd.js');
  } else {
    console.warn('[rabby] dist/232.js cdnUrl pattern not found');
  }
  process.exit(0);
}
fs.writeFileSync(chunk, s.split(from).join(to));
console.log('[rabby] patched dist/232.js → zama-fhe/relayer-sdk-js.umd.js');
