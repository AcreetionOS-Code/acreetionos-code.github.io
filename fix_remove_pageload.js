const fs = require('fs');
const path = require('path');

const root = '.';
const exts = ['.html','.css','.txt'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === 'playwright-report') return;
    const fp = path.join(dir, file);
    if (fs.statSync(fp).isDirectory()) {
      results = results.concat(walk(fp));
    } else {
      if (exts.includes(path.extname(file))) results.push(fp);
    }
  });
  return results;
}

const files = walk(root);
const keyframeRegex = /@keyframes\s*pageLoadFade\s*\{[\s\S]*?\}\s*/gmi;
const bodyAnimRegex = /body\s*\{[^}]*animation:[^;}]*pageLoadFade[^;}]*;?[^}]*\}/gmi;
const bodyOpacityRegex = /body\s*\{[^}]*opacity:\s*0;[^}]*\}/gmi;

files.forEach(f => {
  let c = fs.readFileSync(f,'utf8');
  let orig = c;
  c = c.replace(keyframeRegex, '/* removed pageLoadFade keyframes */');
  c = c.replace(bodyAnimRegex, '/* removed pageLoadFade body animation */');
  c = c.replace(bodyOpacityRegex, '/* removed body opacity to prevent FOUC */');
  if (c !== orig) {
    fs.writeFileSync(f,c,'utf8');
    console.log('Patched', f);
  }
});
console.log('Done');
