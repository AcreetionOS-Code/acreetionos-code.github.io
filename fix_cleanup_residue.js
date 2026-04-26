const fs = require('fs');
const path = require('path');

function walk(dir, list = []){
  const files = fs.readdirSync(dir);
  for(const file of files){
    if(file === 'node_modules' || file === '.git' || file === 'playwright-report') continue;
    const fp = path.join(dir, file);
    if(fs.statSync(fp).isDirectory()) walk(fp, list);
    else if(/\.(html|css|txt)$/.test(fp)) list.push(fp);
  }
  return list;
}

const files = walk('.');
let patched = 0;
files.forEach(f => {
  let c = fs.readFileSync(f,'utf8');
  const orig = c;
  // Remove leftover 'to{...}}' sequences that followed our earlier comment
  c = c.replace(/\/\* removed pageLoadFade keyframes \*\/\s*to\{[^}]+\}\}/g, '/* removed pageLoadFade keyframes */');
  // Remove stray 'to{opacity:1;transform:translateY(0)}}' even without comment
  c = c.replace(/to\{\s*opacity:\s*1;\s*transform:[^}]+\}\}/g, '');
  // Remove any 'from{opacity:0;transform:translateY(10px)}' leftover
  c = c.replace(/from\{\s*opacity:\s*0;\s*transform:[^}]+\}\s*/g, '');
  // Remove 'body{animation:none}}' extra braces
  c = c.replace(/body\{animation:none\}\}/g, 'body{animation:none}');
  if(c !== orig){
    fs.writeFileSync(f,c,'utf8');
    patched++;
    console.log('Cleaned', f);
  }
});
console.log('Done cleanup. Files patched:', patched);
