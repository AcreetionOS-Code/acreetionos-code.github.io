const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git') continue;
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      if (file.endsWith('.html') || file.endsWith('.css')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
};

const files = walkSync('.');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  content = content.replace(/border-radius:\s*0(;|\})/g, 'border-radius: 12px$1');
  content = content.replace(/border-radius:\s*3px(;|\})/g, 'border-radius: 8px$1');
  content = content.replace(/border-radius:\s*4px(;|\})/g, 'border-radius: 12px$1');
  content = content.replace(/border-radius:\s*5px(;|\})/g, 'border-radius: 12px$1');
  content = content.replace(/border-radius:\s*6px(;|\})/g, 'border-radius: 12px$1');
  content = content.replace(/border-radius:\s*8px(;|\})/g, 'border-radius: 16px$1');
  content = content.replace(/border-radius:\s*0\.25rem(;|\})/g, 'border-radius: 0.75rem$1');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
