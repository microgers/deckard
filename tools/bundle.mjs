/**
 * Single-file bundler for the Claude Artifact build.
 *
 * Vite produces dist/ for real hosting. This produces one self-contained HTML
 * file with no external scripts, for environments that only accept a single
 * file. Each module is wrapped in a factory keyed by path, so top-level names
 * cannot collide between modules.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('src');
const ORDER = [];
const SEEN = new Set();
const SRC = new Map();

const IMPORT_RE = /^import\s+(?:\{([^}]*)\}|(\*\s+as\s+\w+)|(\w+))?\s*(?:,\s*\{([^}]*)\})?\s*(?:from\s*)?['"]([^'"]+)['"];?\s*$/gm;

async function walk(rel) {
  if (SEEN.has(rel)) return; SEEN.add(rel);
  const file = path.join(ROOT, rel);
  const code = await readFile(file, 'utf8');
  SRC.set(rel, code);
  const deps = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[5];
    if (spec.endsWith('.css')) continue;
    if (!spec.startsWith('.')) continue;             // bare specifiers stay dynamic
    deps.push(path.normalize(path.join(path.dirname(rel), spec)));
  }
  for (const d of deps) await walk(d);
  ORDER.push(rel);
}

function transform(rel, code) {
  let out = code.replace(IMPORT_RE, (full, named, star, def, named2, spec) => {
    if (spec.endsWith('.css')) return '';
    if (!spec.startsWith('.')) return full;          // leave dynamic/bare alone
    const dep = path.normalize(path.join(path.dirname(rel), spec));
    const list = [named, named2].filter(Boolean).join(',');
    if (!list) return '';
    const bindings = list.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [a, b] = s.split(/\s+as\s+/); return b ? `${a.trim()}: ${b.trim()}` : a.trim(); })
      .join(', ');
    return `const { ${bindings} } = __req(${JSON.stringify(dep)});`;
  });

  // collect exported names, then strip the export keyword
  const names = new Set();
  out = out.replace(/^export\s+(async\s+)?function\s+([\w$]+)/gm, (m, a, n) => { names.add(n); return `${a || ''}function ${n}`; })
           .replace(/^export\s+(const|let|var)\s+([\w$]+)/gm, (m, k, n) => { names.add(n); return `${k} ${n}`; })
           .replace(/^export\s*\{([^}]*)\};?\s*$/gm, (m, list) => {
             list.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
               const [a, b] = s.split(/\s+as\s+/);
               names.add((b || a).trim() + (b ? ':' + a.trim() : ''));
             });
             return '';
           });
  // import.meta and bare dynamic imports are module-only syntax; the artifact
  // build never configures Firebase, so both are neutralised rather than kept.
  out = out.replace(/\(typeof import\.meta !== 'undefined' && import\.meta\.env\) \|\| \{\}/g, '{}')
           .replace(/import\.meta\.env/g, '({})')
           .replace(/import\(\s*['"](firebase[^'"]*)['"]\s*\)/g, 'Promise.reject(new Error("no bundler"))');
  const ret = Array.from(names).map((n) => (n.includes(':') ? n.split(':')[0] + ': ' + n.split(':')[1] : n)).join(', ');
  return `__mods[${JSON.stringify(rel)}] = function(){\n${out}\nreturn { ${ret} };\n};`;
}

const entry = 'main.js';
await walk(entry);
const modules = ORDER.map((rel) => transform(rel, SRC.get(rel))).join('\n\n');
const css = await readFile(path.join(ROOT, 'styles.css'), 'utf8');
let html = await readFile('index.html', 'utf8');

const runtime = `
(function(){
"use strict";
var __mods = {}, __cache = {};
function __req(id){ if(!__cache[id]) __cache[id] = __mods[id](); return __cache[id]; }
${modules}
__req(${JSON.stringify(entry)});
})();`;

// Strip the document skeleton: the Artifact host supplies it.
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
                 .replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const links = head.match(/<link[^>]*fonts\.googleapis[^>]*>/g) || [];
const title = (head.match(/<title>[\s\S]*?<\/title>/) || [''])[0];

await writeFile('dist-artifact.html',
  `${title}\n<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n${links.join('\n')}\n` +
  `<style>\n${css}\n</style>\n${body.trim()}\n<script>${runtime}\n<\/script>\n`);
console.log('dist-artifact.html written —', (await readFile('dist-artifact.html', 'utf8')).length, 'bytes,', ORDER.length, 'modules');
