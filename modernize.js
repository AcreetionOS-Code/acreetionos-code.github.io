const fs = require('fs');
const path = require('path');

const scrollbarCSS = `::-webkit-scrollbar{width:10px;}::-webkit-scrollbar-track{background:var(--acreetion-body-bg,#121212);}::-webkit-scrollbar-thumb{background:var(--acreetion-box-border,#333);border-radius:10px;}::-webkit-scrollbar-thumb:hover{background:var(--acreetion-green,#2ecc71);}`;
const modernGlowsCSS = `.btn{transition:all 0.3s ease;}.btn:hover{box-shadow:0 0 15px rgba(46,204,113,0.4);transform:translateY(-2px);}.content-box{transition:transform 0.3s ease,box-shadow 0.3s ease;}.content-box:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,0.5);}`;
const revealCSS = `.reveal{opacity:0;transform:translateY(30px);transition:all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);will-change:opacity, transform;}.reveal.active{opacity:1;transform:translateY(0);}`;
const glassHeaderCSS = `.page-header{background-color:rgba(24,26,27,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:2px solid var(--acreetion-green);border-radius:0 0 16px 16px;position:sticky;top:0;z-index:1000;}`;

const revealScript = `
<script>
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05, rootMargin: "0px 0px -30px 0px" });
    document.querySelectorAll('.content-box, .dev-card, .event-card, .repo-card').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
});
</script>
</body>`;

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

  // Apply to HTML files
  if (file.endsWith('.html')) {
    // 1. Inject CSS before </style> or in head
    if (content.includes('</style>')) {
      if (!content.includes('::-webkit-scrollbar')) {
        content = content.replace('</style>', `\n${scrollbarCSS}\n${modernGlowsCSS}\n${revealCSS}\n</style>`);
      }
    } else if (content.includes('</head>')) {
      if (!content.includes('::-webkit-scrollbar')) {
        content = content.replace('</head>', `<style>\n${scrollbarCSS}\n${modernGlowsCSS}\n${revealCSS}\n</style>\n</head>`);
      }
    }

    // 2. Glassmorphism Header (replace existing)
    content = content.replace(/\.page-header\s*\{[^\}]+\}/g, glassHeaderCSS);

    // 3. Inject Reveal Script before </body>
    if (!content.includes('IntersectionObserver') && content.includes('</body>')) {
      content = content.replace('</body>', revealScript);
    }
  }

  // Apply to CSS files
  if (file.endsWith('.css')) {
    if (!content.includes('::-webkit-scrollbar')) {
      content += `\n${scrollbarCSS}\n${modernGlowsCSS}\n${revealCSS}`;
    }
    content = content.replace(/\.page-header\s*\{[^\}]+\}/g, glassHeaderCSS);
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Modernized ${file}`);
  }
}
