const fs = require('fs');
const s = fs.readFileSync('node_modules/@zama-fhe/sdk/dist/esm/index.js', 'utf8');
const i = s.indexOf('integrityCheck');
console.log(s.slice(i, i + 250));
