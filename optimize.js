const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'playwright-report') continue;
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

  // 1. Replace PNG logos with WebP (massive size savings)
  content = content.replace(/acreetionoslogo\.png/g, 'acreetionoslogo.webp');
  content = content.replace(/logo\.png/g, 'logo.webp');
  // Keep original formats — actual files are Natalie.jpg and Bella.png

  // 2. Add dns-prefetch and preconnect for external resources
  if (content.includes('fonts.googleapis.com') && !content.includes('dns-prefetch')) {
    const preconnect = '<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>';
    const dnsPrefetch = '<link rel="dns-prefetch" href="https://fonts.googleapis.com">';
    content = content.replace(preconnect, dnsPrefetch + '\n' + preconnect);
  }

  // 3. Add loading="lazy" to non-critical images (preserve eager for above-fold)
  // Only add lazy loading to images that don't already have loading attribute
  content = content.replace(/<img([^>]*?)>/g, (match, attrs) => {
    if (attrs.includes('loading=')) return match;
    if (attrs.includes('class="logo-img"') || attrs.includes('class="hero-logo-img"')) {
      // These are above-fold, keep as eager or add if missing
      return `<img${attrs} loading="eager">`;
    }
    return `<img${attrs} loading="lazy" decoding="async">`;
  });

  // 4. Minify inline CSS in <style> tags (but preserve comments that say "removed")
  content = content.replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
    // Don't minify if it contains important comments
    if (css.includes('/*') && css.includes('removed')) return match;
    const minified = css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove CSS comments
      .replace(/\s+/g, ' ')              // Collapse whitespace
      .replace(/;\s*}/g, '}')            // Remove last semicolon before }
      .replace(/\{\s+/g, '{')            // Remove space after {
      .replace(/\s+\}/g, '}')            // Remove space before }
      .replace(/,\s+/g, ',')             // Remove space after comma
      .replace(/:\s+/g, ':')             // Remove space after colon
      .replace(/;\s+/g, ';')             // Remove space after semicolon
      .trim();
    return `<style>${minified}</style>`;
  });

  // 5. Minify inline JS in <script> tags
  content = content.replace(/<script>([\s\S]*?)<\/script>/g, (match, js) => {
    // Don't minify if it contains important comments
    if (js.includes('/*') && js.includes('removed')) return match;
    // Simple minification - remove excessive whitespace but preserve structure
    const minified = js
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '')         // Remove line comments
      .replace(/\n\s*/g, ' ')            // Collapse newlines and indentation
      .replace(/\s+/g, ' ')              // Collapse multiple spaces
      .replace(/;\s*}/g, '}')            // Remove last semicolon before }
      .replace(/\{\s+/g, '{')
      .replace(/\s+\}/g, '}')
      .replace(/,\s+/g, ',')
      .replace(/:\s+/g, ':')
      .replace(/;\s+/g, ';')
      .trim();
    return `<script>${minified}</script>`;
  });

  // 6. Minify HTML whitespace between tags (preserve content)
  content = content.replace(/>\s+</g, '><');

  // 7. Add cache-control meta tags for performance
  if (!content.includes('Cache-Control') && file.endsWith('.html')) {
    content = content.replace('<head>', '<head>\n<meta http-equiv="Cache-Control" content="max-age=3600">');
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Optimized ${file}`);
  }
}
