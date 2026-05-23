const fs = require('fs');
const s = fs.readFileSync('dist/232.js', 'utf8');
for (const needle of [
  'relayer-sdk.worker.js',
  'getURL',
  'new Worker',
  'createObjectURL',
  'integrityCheck',
  'integrity:',
]) {
  const n = (s.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [])
    .length;
  console.log(needle, n);
}
const i = s.indexOf('relayer-sdk.worker');
if (i >= 0) console.log(s.slice(i - 60, i + 100));
