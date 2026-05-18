// Build a CommonJS bundle of the public API at dist/index.cjs.
// We translate the few `import`/`export` lines we use ourselves; no transpiler.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = join(root, 'src');
const outDir = join(root, 'dist');

function toCjs(source) {
  let s = source;

  // export function foo  ->  function foo (recorded for module.exports)
  const named = new Set();

  s = s.replace(/^export\s+function\s+(\w+)/gm, (_m, name) => {
    named.add(name);
    return `function ${name}`;
  });

  s = s.replace(/^export\s+(const|let|var)\s+(\w+)/gm, (_m, kw, name) => {
    named.add(name);
    return `${kw} ${name}`;
  });

  // export { a, b } from './x.js'  ->  const { a, b } = require('./x.js');
  s = s.replace(
    /^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/gm,
    (_m, names, path) => {
      const cleaned = names
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      cleaned.forEach((n) => named.add(n));
      const cjsPath = path.replace(/\.js$/, '.cjs');
      return `const { ${cleaned.join(', ')} } = require('${cjsPath}');`;
    }
  );

  // export { a, b }  ->  (recorded only)
  s = s.replace(/^export\s*\{([^}]+)\};?/gm, (_m, names) => {
    names
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach((n) => named.add(n));
    return '';
  });

  // import { a, b } from './x.js'  ->  const { a, b } = require('./x.cjs');
  s = s.replace(
    /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/gm,
    (_m, names, path) => {
      const cjsPath = path.replace(/\.js$/, '.cjs');
      return `const {${names}} = require('${cjsPath}');`;
    }
  );

  // import x from 'node:fs'  ->  const x = require('node:fs');
  s = s.replace(
    /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/gm,
    (_m, name, path) => `const ${name} = require('${path}');`
  );

  if (named.size > 0) {
    s += `\nmodule.exports = { ${[...named].join(', ')} };\n`;
  }
  return s;
}

mkdirSync(outDir, { recursive: true });
const files = readdirSync(srcDir).filter((f) => f.endsWith('.js'));
for (const file of files) {
  const inPath = join(srcDir, file);
  const outPath = join(outDir, file.replace(/\.js$/, '.cjs'));
  const source = readFileSync(inPath, 'utf8');
  const converted = toCjs(source);
  writeFileSync(outPath, converted);
  console.log(`built ${outPath}`);
}
