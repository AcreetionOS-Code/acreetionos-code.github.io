const fs = require('fs');
const path = require('path');

const unifyCSS = `
/* Unify container pages with index.html design language */
.container{display:grid;grid-template-columns:1fr;gap:2rem;max-width:900px;margin:2rem auto;padding:0 2rem;width:100%;}
.container > h1,.container > h2,.container > h3{padding:0 0.5rem;}
.container > p{padding:0 0.5rem;}
.container > img,.container > .profile-img{margin:0 0.5rem 2rem;}
.container .highlight-box{background-color:var(--acreetion-box-bg);border:1px solid var(--acreetion-box-border);border-radius:12px;padding:0;margin:0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:transform 0.3s ease,box-shadow 0.3s ease;}
.container .highlight-box:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,0.5);}
.container .highlight-box h1,.container .highlight-box h2,.container .highlight-box h3{padding:0.8rem 1.2rem;border-bottom:1px solid var(--acreetion-box-border);background-color:#1a1a1a;margin:0;font-size:1.3rem;color:var(--acreetion-text-bright);font-family:var(--font-mono);}
.container .highlight-box p{padding:1.5rem;margin:0;font-size:1rem;}
.container .highlight-box ul{padding:0 1.5rem 1.5rem;margin:0;list-style:none;}
.container .highlight-box li{margin-bottom:0.5rem;}
.page-footer{text-align:center;padding:2rem;margin-top:2rem;border-top:1px solid var(--acreetion-box-border);color:#777;font-size:0.9rem;}
.page-footer p{color:#777;margin-bottom:0.5rem;}
.page-footer a{color:var(--acreetion-green);text-decoration:none;}
.page-footer a:hover{text-decoration:underline;}
`;

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'playwright-report') continue;
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      if (file.endsWith('.html')) {
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

  // Only process pages that use .container or .footer (not already using page-wrapper)
  const hasContainer = content.includes('class="container"');
  const hasOldFooter = content.includes('class="footer"') && !content.includes('class="page-footer"');

  if (hasContainer || hasOldFooter) {
    // Inject unify CSS
    if (content.includes('</style>')) {
      if (!content.includes('/* Unify container pages')) {
        content = content.replace('</style>', `\n${unifyCSS}\n</style>`);
      }
    }

    // Change footer class
    if (hasOldFooter) {
      content = content.replace(/class="footer"/g, 'class="page-footer"');
    }

    // Fix duplicate skip links
    const skipLinkMatches = content.match(/class="skip-link"/g);
    if (skipLinkMatches && skipLinkMatches.length > 1) {
      // Remove duplicate skip links, keeping only the first one
      const firstSkipIndex = content.indexOf('<a href="#main-content" class="skip-link">');
      const secondSkipIndex = content.indexOf('<a href="#main-content" class="skip-link">', firstSkipIndex + 1);
      if (secondSkipIndex > -1) {
        const endOfSecondSkip = content.indexOf('</a>', secondSkipIndex) + 4;
        content = content.substring(0, secondSkipIndex) + content.substring(endOfSecondSkip);
      }
    }

    // Add id="main-content" to container if not present
    if (hasContainer && !content.includes('id="main-content"')) {
      content = content.replace(/<div class="container">/, '<div class="container" id="main-content">');
    }

    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Unified ${file}`);
    }
  }
}
