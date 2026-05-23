const fs = require('fs');
const path = require('path');

const MANIFEST_TYPE = process.env.MANIFEST_TYPE || 'chrome-mv3';
const distDir = MANIFEST_TYPE.endsWith('-mv2')
  ? path.join(__dirname, '..', 'dist-mv2')
  : path.join(__dirname, '..', 'dist');

fs.mkdirSync(distDir, { recursive: true });

for (const entry of fs.readdirSync(distDir)) {
  fs.rmSync(path.join(distDir, entry), { recursive: true, force: true });
}
