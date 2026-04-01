const fs = require('fs');
const s = fs.readFileSync('public/app.js', 'utf8');
const stack = [];
let state = 'code';
let line = 1;
let col = 0;
let escape = false;
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  const nx = s[i + 1];
  col++;
  if (ch === '\n') { line++; col = 0; }

  if (state === 'lineComment') { if (ch === '\n') state = 'code'; continue; }
  if (state === 'blockComment') { if (ch === '*' && nx === '/') { state = 'code'; i++; col++; } continue; }
  if (state === 'single') { if (!escape && ch === "'") state = 'code'; escape = (!escape && ch === '\\'); continue; }
  if (state === 'double') { if (!escape && ch === '"') state = 'code'; escape = (!escape && ch === '\\'); continue; }
  if (state === 'template') {
    if (!escape && ch === '`') { state = 'code'; continue; }
    if (!escape && ch === '\\') { escape = true; continue; }
    if (escape) { escape = false; continue; }
    if (ch === '$' && nx === '{') { stack.push({ t: '${', line, col }); i++; col++; continue; }
    if (ch === '}' && stack.length && stack[stack.length - 1].t === '${') { stack.pop(); continue; }
    continue;
  }

  if (ch === '/' && nx === '/') { state = 'lineComment'; i++; col++; continue; }
  if (ch === '/' && nx === '*') { state = 'blockComment'; i++; col++; continue; }
  if (ch === "'") { state = 'single'; escape = false; continue; }
  if (ch === '"') { state = 'double'; escape = false; continue; }
  if (ch === '`') { state = 'template'; escape = false; continue; }

  if (ch === '{' || ch === '(' || ch === '[') { stack.push({ t: ch, line, col }); continue; }
  if (ch === '}' || ch === ')' || ch === ']') {
    const open = stack.pop();
    const expect = ch === '}' ? '{' : (ch === ')' ? '(' : '[');
    if (!open) { console.log('extra close', ch, 'at', line + ':' + col); process.exit(1); }
    if (open.t !== expect) { console.log('mismatch', open.t, 'opened at', open.line + ':' + open.col, 'closed by', ch, 'at', line + ':' + col); process.exit(1); }
  }
}
if (stack.length) {
  const top = stack[stack.length - 1];
  console.log('unclosed', top.t, 'opened at', top.line + ':' + top.col, 'depth', stack.length);
  process.exit(1);
}
console.log('balanced');
