// Test-only dev server. Serves the real source over native ES modules so the
// app can be exercised in a browser without a bundler (npm is unavailable in
// this sandbox). Two transforms only: drop the CSS import (index.html links the
// stylesheet directly) and leave everything else byte-for-byte.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(process.argv[2] || '.');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  try {
    let body = await readFile(file);
    const ext = path.extname(file);
    if (ext === '.js') {
      body = body.toString().replace(/^import\s+['"]\.\/styles\.css['"];?\s*$/m, '');
    }
    if (ext === '.html') {
      body = body.toString().replace('</head>', '<link rel="stylesheet" href="/src/styles.css"></head>');
    }
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(Number(process.env.PORT) || 5199, () => console.log('serving', ROOT));
