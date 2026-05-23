const fs = require('fs');
const s = fs.readFileSync('dist/232.js', 'utf8');
let idx = 0;
let n = 0;
while ((idx = s.indexOf('integrityCheck', idx)) >= 0 && n < 5) {
  console.log('---', n, s.slice(idx - 80, idx + 120));
  idx += 1;
  n += 1;
}
