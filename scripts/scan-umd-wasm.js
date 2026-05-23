const fs = require('fs');
const s = fs.readFileSync(
  'node_modules/@zama-fhe/relayer-sdk/bundle/relayer-sdk-js.umd.cjs',
  'utf8'
);
let idx = 0;
let n = 0;
while ((idx = s.indexOf('tfhe_bg.wasm', idx)) >= 0 && n < 3) {
  console.log(s.slice(idx - 100, idx + 120));
  idx += 1;
  n += 1;
}
