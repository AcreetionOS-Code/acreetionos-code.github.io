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

  // Add border-radius to page-header
  content = content.replace(/\.page-header\s*\{([^\}]+)\}/g, (match, inner) => {
    if (!inner.includes('border-radius: 0 0 16px 16px')) {
      return `.page-header {${inner} border-radius: 0 0 16px 16px;}`;
    }
    return match;
  });

  // Handle inline page-header CSS (minified)
  content = content.replace(/\.page-header\{([^\}]+)\}/g, (match, inner) => {
    if (!inner.includes('border-radius: 0 0 16px 16px')) {
      return `.page-header{${inner} border-radius: 0 0 16px 16px;}`;
    }
    return match;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated header in ${file}`);
  }
}
