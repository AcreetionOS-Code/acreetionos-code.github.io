const fs = require('fs');
const path = require('path');

const codeBlockCSS = `
pre{position:relative;}
.copy-code-btn{position:absolute;top:8px;right:8px;background:rgba(46,204,113,0.15);color:var(--acreetion-green,#2ecc71);border:1px solid rgba(46,204,113,0.3);border-radius:8px;padding:4px 10px;font-size:0.75rem;cursor:pointer;opacity:0;transition:opacity 0.2s,background 0.2s;font-family:var(--font-sans);font-weight:600;}
pre:hover .copy-code-btn{opacity:1;}
.copy-code-btn:hover{background:rgba(46,204,113,0.3);}
.copy-code-btn.copied{background:var(--acreetion-green,#2ecc71);color:#000;}
`;

const tableCSS = `
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--acreetion-box-border);border-radius:12px;overflow:hidden;margin:1rem 0;}
th{background:var(--acreetion-panel-bg);color:var(--acreetion-text-bright);font-weight:700;padding:0.75rem 1rem;text-align:left;border-bottom:2px solid var(--acreetion-green);}
td{padding:0.6rem 1rem;border-bottom:1px solid var(--acreetion-box-border);color:var(--acreetion-text);}
tr:last-child td{border-bottom:none;}
tr:hover td{background:rgba(46,204,113,0.05);}
`;

const toastCSS = `
#toast-container{position:fixed;bottom:90px;right:30px;z-index:10000;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;}
.toast{background:var(--acreetion-box-bg);border:1px solid var(--acreetion-green);color:var(--acreetion-text-bright);padding:0.75rem 1.25rem;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:0.9rem;font-weight:500;opacity:0;transform:translateY(20px);transition:all 0.3s ease;pointer-events:auto;}
.toast.show{opacity:1;transform:translateY(0);}
`;

const copyCodeScript = `
<script>
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('pre').forEach(pre => {
        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.textContent = 'Copy';
        btn.onclick = () => {
            const code = pre.querySelector('code');
            if(code){
                navigator.clipboard.writeText(code.textContent).then(() => {
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    showToast('Copied to clipboard!');
                    setTimeout(() => {btn.textContent = 'Copy';btn.classList.remove('copied');}, 2000);
                });
            }
        };
        pre.appendChild(btn);
    });
    function showToast(msg){
        let container = document.getElementById('toast-container');
        if(!container){container = document.createElement('div');container.id = 'toast-container';document.body.appendChild(container);}
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {toast.classList.remove('show');setTimeout(() => toast.remove(), 300);}, 3000);
    }
});
</script>
</body>`;

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
      if (!content.includes('.copy-code-btn')) {
        content = content.replace('</style>', `\n${codeBlockCSS}\n${tableCSS}\n${toastCSS}\n</style>`);
      }
    } else if (content.includes('</head>')) {
      if (!content.includes('.copy-code-btn')) {
        content = content.replace('</head>', `<style>\n${codeBlockCSS}\n${tableCSS}\n${toastCSS}\n</style>\n</head>`);
      }
    }

    // Inject copy code script before </body>
    if (!content.includes('copy-code-btn') && content.includes('</body>')) {
      // Only add if there are pre blocks
      if (content.includes('<pre')) {
        content = content.replace('</body>', `${copyCodeScript}`);
      }
    }
  }

  if (file.endsWith('.css')) {
    if (!content.includes('.copy-code-btn')) {
      content += `\n${codeBlockCSS}\n${tableCSS}\n${toastCSS}`;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Enhanced ${file}`);
  }
}
