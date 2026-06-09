const EDITIONS = [
  {id:'cinnamon', label:'Cinnamon Edition', desc:'The main AcreetionOS flagship desktop. Stable and feature-rich.', official:true,
   iso_url:'https://iso.acreetionos.org:8448/acreetion/AcreetionOS-1.0-x86_64.iso',
   mirrors:[{url:'https://archive.org/download/AcreetionOS-1.0-x86_64/AcreetionOS-1.0-x86_64.iso',name:'Internet Archive'},
             {url:'https://sourceforge.net/projects/acreetionos-iso-image/files/AcreetionOS-1.0-x86_64.iso/download',name:'SourceForge'},
             {url:'https://ftp2.osuosl.org/pub/acreetionos/AcreetionOS-1.0-x86_64.iso',name:'OSUOSL'},
             {url:'https://ftp.halifax.rwth-aachen.de/acreetionos/AcreetionOS-1.0-x86_64.iso',name:'RWTH Aachen'}]},

  {id:'xl', label:'XL (XLibre) Edition', desc:'Featuring the XLibre display server, the successor to Xorg.', official:true,
   iso_url:'https://iso.acreetionos.org:8448/acreetion/AcreetionOS_XL-1.0-x86_64.iso',
    mirrors:[{url:'https://archive.org/download/AcreetionOS_XL-1.0-x86_64/AcreetionOS_XL-1.0-x86_64.iso',name:'Internet Archive'},
             {url:'https://sourceforge.net/projects/acreetionos-iso-image/files/AcreetionOS_XL-1.0-x86_64.iso/download',name:'SourceForge'},
             {url:'https://ftp2.osuosl.org/pub/acreetionos/AcreetionOS_XL-1.0-x86_64.iso',name:'OSUOSL'},
             {url:'https://ftp.halifax.rwth-aachen.de/acreetionos/AcreetionOS_XL-1.0-x86_64.iso',name:'RWTH Aachen'}]},



  {id:'mate', label:'Mate Edition', desc:'AcreetionOS Configured with the MATE Desktop Environment.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-Mate-latest.iso'},
  
  {id:'lxqt', label:'LXQT Edition', desc:'AcreetionOS Configured with the LXQT Desktop Environment.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-LXQT-latest.iso'},

   {id:'lxde', label:'LXDE Edition', desc:'AcreetionOS Configured with the LXDE Desktop Environment.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-LXDE-latest.iso'},

   {id:'budgie', label:'Budgie Edition', desc:'AcreetionOS Configured with the Budgie Desktop Environment.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-Budgie-latest.iso'},

   {id:'cosmic', label:'Cosmic Edition', desc:'AcreetionOS Configured with the Cosmic Desktop Environment.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-Cosmic-latest.iso'},

  {id:'plasma', label:'Plasma Edition', desc:'Modern, powerful KDE Plasma desktop experience.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-Plasma-latest.iso'},

  {id:'gnome', label:'GNOME Edition', desc:'Sleek and modern GNOME desktop environment.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-GNOME-latest.iso'},

  {id:'hyprland', label:'Hyprland Edition', desc:'Wayland tiling compositor with pre-configured Jakoolit configs.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-Hyprland-latest.iso'},

  {id:'xfce', label:'XFCE Edition', desc:'Lightweight and lightning fast for older hardware.', official:false,
   iso_url:'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-XFCE-latest.iso'}
];

function loadEditions() {
    const container = document.getElementById('editions-container');
    const official = EDITIONS.filter(e => e.official);
    const unofficial = EDITIONS.filter(e => !e.official);

    let html = `<h3 class="section-title-official">Official Editions</h3>`;
    html += `<div class="edition-grid">`;
    official.forEach(e => { html += renderEditionCard(e); });
    html += `</div>`;

    html += `<h3 class="section-title-community">Community Editions &mdash; Preview</h3>`;
    html += `<div class="info-box" style="margin-bottom:1.5rem; background:rgba(97,175,239,0.05); border-color:var(--storm-color)">`;
    html += `<p style="margin:0 0 0.75rem 0"><strong><i class="bi bi-info-circle"></i> These editions are on the way.</strong> When they drop, you can flash them with the Terminal <code>dd</code> command above — just paste the ISO URL, enter your USB device, and hit <em>Generate Command</em>. Or use the <strong>Desktop App Flasher</strong> for a point-and-click experience.</p>`;
    html += `<p style="margin:0; font-size:0.85rem; color:var(--acreetion-text)">New to <code>dd</code>? It&rsquo;s simple: <code>sudo dd if=/path/to/iso of=/dev/sdX bs=4M status=progress && sync</code>. <strong>Double-check your device</strong> — <code>dd</code> will overwrite whatever you point it at.</p>`;
    html += `</div>`;
    html += `<div class="edition-grid">`;
    unofficial.forEach(e => { html += renderEditionCard(e, true); });
    html += `</div>`;
     html += `<div style="margin-top:2rem; background: linear-gradient(135deg, rgba(88,101,242,0.1) 0%, rgba(88,101,242,0.05) 100%); border: 1px solid #5865F2; border-radius: 12px; padding: 1.5rem; text-align: center">
         <i class="bi bi-discord" style="font-size:1.5rem;color:#5865F2;display:block;margin-bottom:0.5rem"></i>
         <p style="margin:0 0 1rem 0;font-size:0.95rem;color:var(--acreetion-text)">Want more Window Managers, Compositors, or Desktop Environments?</p>
         <a href="https://discord.acreetionos.org" class="btn btn-storm" style="background:#5865F2;color:#fff;font-size:0.9rem" target="_blank" rel="noopener"><i class="bi bi-discord"></i> Join our Discord</a>
     </div>`;

    container.innerHTML = html;

    const ddSelect = document.getElementById('dd-edition');
    if (ddSelect) {
        ddSelect.innerHTML = '';
        official.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.iso_url;
            opt.textContent = e.label;
            ddSelect.appendChild(opt);
        });
    }
}

function renderEditionCard(e, isCommunity = false) {
    let mirrorHTML = '';
    if (e.mirrors && e.mirrors.length > 0) {
        e.mirrors.forEach(m => {
            mirrorHTML += `<a href="${m.url}" class="btn btn-mirror" target="_blank" rel="noopener">${m.name}</a>`;
        });
    }

    const maintainerBtn = isCommunity
        ? `<a href="https://tally.so/r/rjvgKL" class="btn" style="background:linear-gradient(135deg,var(--acreetion-purple),#8e44ad);color:#fff;padding:0.55rem 1rem;font-size:0.8rem;box-shadow:0 4px 14px rgba(155,89,182,0.3);margin-left:4px" target="_blank" rel="noopener" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(155,89,182,0.45)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(155,89,182,0.3)'"><i class="bi bi-person-plus"></i> Apply for Maintainership</a>`
        : '';

    return `
    <div class="edition-card">
        <div>
            <h4 class="card-title">${e.label}</h4>
            <p class="card-desc">${e.desc}</p>
        </div>
        <div class="card-actions">
            <a href="${e.iso_url}" class="btn btn-cinnamon">${isCommunity ? 'Coming Soon' : 'Download ISO'}</a>
            ${maintainerBtn}
            ${mirrorHTML}
        </div>
    </div>`;
}

function generateDD() {
    const url = document.getElementById('dd-edition').value;
    const dev = document.getElementById('dd-device').value || '/dev/sdX';
    const cmd = `# Download ISO\ncurl -L -o /tmp/acreetionos.iso "${url}"\n\n# Flash to USB\nsudo dd if=/tmp/acreetionos.iso of=${dev} bs=4M status=progress && sync\necho "Done!"`;
    document.getElementById('dd-code').textContent = cmd;
    document.getElementById('dd-output').style.display = 'block';
}

function closeBuildModal() {
    document.getElementById('build-modal').classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', function() {
  loadEditions();
  document.getElementById('build-modal-close').addEventListener('click', closeBuildModal);
});

const FLASHER_URLS = {
    windows: 'https://github.com/spivanatalie64/AcreetionMediaWriter/releases/download/5.3.1/AcreetionOSMediaWriter-win64-5.3.1.exe',
    macos_intel: 'https://github.com/spivanatalie64/AcreetionMediaWriter/releases/download/5.3.1/AcreetionOSMediaWriter-macos-5.3.1.dmg',
    macos_arm: 'https://github.com/spivanatalie64/AcreetionMediaWriter/releases/download/5.3.1/AcreetionOSMediaWriter-macos-arm64-5.3.1.dmg',
    linux: 'https://github.com/spivanatalie64/AcreetionMediaWriter/releases/download/5.3.1/AcreetionOSMediaWriter-linux-x86_64-5.3.1.AppImage',
    fallback: 'https://github.com/spivanatalie64/AcreetionMediaWriter/releases'
};

function detectOS() {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'windows';
    if (ua.includes('Linux') && !ua.includes('Android')) return 'linux';
    if (ua.includes('Mac')) return 'macos';
    return null;
}

document.addEventListener('DOMContentLoaded', async () => {
    const btn = document.getElementById('flasher-download-btn');
    if (!btn) return;

    const os = detectOS();
    if (!os) return;

    if (os === 'macos') {
        let isArm = false;
        try {
            if (navigator.userAgentData?.getHighEntropyValues) {
                const ua = await navigator.userAgentData.getHighEntropyValues(['architecture']);
                isArm = ua.architecture === 'arm';
            }
        } catch (e) {}
        btn.href = isArm ? FLASHER_URLS.macos_arm : FLASHER_URLS.macos_intel;
    } else if (os === 'windows') {
        btn.href = FLASHER_URLS.windows;
    } else if (os === 'linux') {
        btn.href = FLASHER_URLS.linux;
    }
});
