const fs = require('fs');
const path = require('path');

const accessibilityCSS = `
html{scroll-behavior:smooth;}
::selection{background:rgba(46,204,113,0.3);color:var(--acreetion-text-bright,#fff);}
:focus-visible{outline:2px solid var(--acreetion-green,#2ecc71);outline-offset:3px;border-radius:4px;}
a:focus-visible,button:focus-visible{outline:2px solid var(--acreetion-green,#2ecc71);outline-offset:3px;}
.skip-link{position:absolute;top:-40px;left:0;background:var(--acreetion-green,#2ecc71);color:#000;padding:8px 16px;text-decoration:none;font-weight:700;z-index:10000;transition:top 0.3s;border-radius:0 0 8px 0;}
.skip-link:focus{top:0;}
@media (prefers-reduced-motion: reduce) {
  html{scroll-behavior:auto;}
  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important;}
}
`;

const pageLoadCSS = ``; // removed page-load fade to prevent FOUC / flash

const modernLinkCSS = `
a{color:var(--acreetion-green,#2ecc71);text-decoration:none;position:relative;}
a:not(.btn):not(.logo):not(.skip-link):not(.social-link):hover{text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px;}
`;

const skipLinkHTML = `<a href="#main-content" class="skip-link">Skip to main content</a>`;

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
      if (!content.includes('scroll-behavior:smooth')) {
        content = content.replace('</style>', `\n${accessibilityCSS}\n${pageLoadCSS}\n${modernLinkCSS}\n</style>`);
      }
    } else if (content.includes('</head>')) {
      if (!content.includes('scroll-behavior:smooth')) {
        content = content.replace('</head>', `<style>\n${accessibilityCSS}\n${pageLoadCSS}\n${modernLinkCSS}\n</style>\n</head>`);
      }
    }

    // Add skip link after <body> tag
    if (!content.includes('class="skip-link"')) {
      content = content.replace('<body>', `<body>\n${skipLinkHTML}`);
      // Also handle minified body tags
      content = content.replace(/<body([^>]*)>/, `<body$1>\n${skipLinkHTML}`);
    }

    // Add id="main-content" to the first <main> or content wrapper
    if (content.includes('<main') && !content.includes('id="main-content"')) {
      content = content.replace(/<main/, '<main id="main-content"');
    } else if (content.includes('class="page-wrapper"') && !content.includes('id="main-content"')) {
      content = content.replace(/class="page-wrapper"/, 'id="main-content" class="page-wrapper"');
    }
  }

  if (file.endsWith('.css')) {
    if (!content.includes('scroll-behavior:smooth')) {
      content += `\n${accessibilityCSS}\n${pageLoadCSS}\n${modernLinkCSS}`;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Accessibility + Modernized ${file}`);
  }
}
