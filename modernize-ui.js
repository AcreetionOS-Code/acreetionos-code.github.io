const fs = require('fs');
const path = require('path');

const backToTopCSS = `
#back-to-top{position:fixed;bottom:30px;right:30px;background:var(--acreetion-green,#2ecc71);color:#000;border:none;border-radius:50%;width:48px;height:48px;cursor:pointer;z-index:999;font-size:1.2rem;font-weight:700;opacity:0;visibility:hidden;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;padding-bottom:4px;}
#back-to-top.visible{opacity:1;visibility:visible;}
#back-to-top:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(46,204,113,0.4);}
`;

const backToTopHTML = `<button id="back-to-top" title="Back to top" >↑</button>`;

const backToTopScript = `
<script>
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('back-to-top');
    if(!btn) return;
    window.addEventListener('scroll', () => {
        if(window.scrollY > 400){btn.classList.add('visible');}
        else{btn.classList.remove('visible');}
    });
});
</script>
</body>`;

const bgPatternCSS = `
body{background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);background-size:40px 40px;}
`;

const activeNavCSS = `
.main-nav a.active,.main-nav a[aria-current="page"]{background-color:var(--acreetion-green,#2ecc71);color:#000;font-weight:700;border-radius:12px;padding:0.5rem 1rem;}
`;

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

  if (file.endsWith('.html')) {
    // Inject CSS
    if (content.includes('</style>')) {
      if (!content.includes('#back-to-top')) {
        content = content.replace('</style>', `\n${backToTopCSS}\n${bgPatternCSS}\n${activeNavCSS}\n</style>`);
      }
    } else if (content.includes('</head>')) {
      if (!content.includes('#back-to-top')) {
        content = content.replace('</head>', `<style>\n${backToTopCSS}\n${bgPatternCSS}\n${activeNavCSS}\n</style>\n</head>`);
      }
    }

    // Add back-to-top button before </body>
    if (!content.includes('id="back-to-top"')) {
      content = content.replace('</body>', `${backToTopHTML}\n${backToTopScript}`);
    }

    // Highlight active nav link based on filename
    const pageName = path.basename(file);
    if (pageName !== 'index.html') {
      const navLinkPattern = new RegExp(`href="${pageName}"`, 'g');
      content = content.replace(navLinkPattern, `href="${pageName}" class="active" aria-current="page"`);
    }
  }

  if (file.endsWith('.css')) {
    if (!content.includes('#back-to-top')) {
      content += `\n${backToTopCSS}\n${bgPatternCSS}\n${activeNavCSS}`;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Enhanced ${file}`);
  }
}
