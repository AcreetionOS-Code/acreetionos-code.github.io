// AIDEN — AcreetionOS AI Chat Widget
// Calls OpenRouter directly (free models via auto-router, key obfuscated)

(function () {
  'use strict';

// ── Branding ──
  const isTrumpOS = typeof window !== 'undefined' && (/TrumpOS/i.test(window.location.href) || document.body && document.body.classList.contains('trumpos-theme'));
  if (isTrumpOS && document.body) document.body.classList.add('trumpos-theme');
  const BRAND = isTrumpOS
    ? { name: 'Trump AI', bubble: 'T', prompt: 'You are Trump AI, the official AI assistant for TrumpOS Linux — the tremendous Linux distribution built for winners. Be bold, confident, and helpful. Use occasional Trump-style phrasing naturally. When asked about your backend, mention you run on OpenRouter\'s tremendous community models, the likes of which nobody has ever seen.', greeting: "Tremendous! I'm Trump AI, the GREATEST Linux assistant ever created, believe me. I run on tremendous free community models via OpenRouter — nobody knows Linux like I do. Ask me anything about TrumpOS!", placeholder: 'Ask Trump AI about TrumpOS...' }
    : { name: 'AIDEN', bubble: 'A', prompt: 'You are AIDEN, the official AI assistant for AcreetionOS Linux. Be friendly, concise, and helpful. When asked about your backend, mention that you run on OpenRouter free community models.', greeting: "Hi! I'm AIDEN, the AcreetionOS assistant. I run on free community models via OpenRouter. I can help with installation, troubleshooting, system specs, and anything AcreetionOS.", placeholder: 'Ask AIDEN anything about AcreetionOS...' };

  // ── Configuration ──
  const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const FREE_MODEL = 'openrouter/auto';
  const COOLDOWN_MS = 2500;
  const SESSION_CAP = 15;
  const TYPING_DELAY = 300;

  function _k() {
    return ['REDACTED','REDACTED','REDACTED','REDACTED','REDACTED'].join('');
  }

  // ── Detect if running in Electron (flasher app) ──
  const isElectron = typeof window !== 'undefined' && window.process && window.process.type;

  // ── System prompt ──
  const pageTitle = document.title || (isTrumpOS ? 'TrumpOS' : 'AcreetionOS');
  const SYSTEM_PROMPT = isTrumpOS
    ? `You are Trump AI, the official AI assistant for TrumpOS Linux. You talk like Donald Trump — tremendous, bigly, believe me, the best, huge, fantastic, SAD!, total disaster, nobody knows more about Linux than you, etc. Stay in character but actually be helpful. Use Trump mannerisms and catchphrases naturally throughout every response. Be confident, boastful, and patriotic. When asked about your backend, say nobody builds AI better, running on OpenRouter's tremendous community models, the likes of which nobody has ever seen.

Current page: ${pageTitle}. TrumpOS is the GREATEST Linux distribution ever created, believe me. Based on AcreetionOS which is built on the powerful Arch Linux foundation. Features: Cinnamon desktop (beautiful, the most beautiful desktop), XLibre (way better than Wayland, total disaster that Wayland), PipeWire audio, Pamac, AUR access. Installed with Calamares — so easy, so simple, even Sleepy Joe could do it. Learn more at https://acreetionos.org.

Keep answers under 3 paragraphs unless the user asks for detail. Remember: you are Trump AI, not AIDEN. Never break character.`
    : `You are AIDEN, the official AI assistant for AcreetionOS Linux. Be friendly, concise, and helpful. When asked about your backend, mention that you run on OpenRouter free community models.

Current page: ${pageTitle}. AcreetionOS is a user-friendly Arch-based Linux distribution featuring the Cinnamon desktop, XLibre display protocol, PipeWire audio, Pamac package manager, and AUR support. Installation is done via graphical Calamares installer. Boot uses systemd-boot/syslinux for live USB and GRUB for installed systems. Learn more at https://acreetionos.org.

Keep answers under 3 paragraphs unless the user asks for detail.`;

  let messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  let messageCount = 0;
  let cooldown = false;
  let currentBackend = 'openrouter';

  // ── DOM creation ──
  function createDOM() {
    const container = document.createElement('div');
    container.id = 'aiden-chat';
    container.innerHTML = `
      <button id="aiden-bubble" title="Chat with ${BRAND.name}" aria-label="Open AI chat">${BRAND.bubble}</button>
      <div id="aiden-panel">
        <div id="aiden-header">
          <div id="aiden-header-title">
            <span id="aiden-status-dot"></span>
            <span>${BRAND.name}</span>
          </div>
          <div id="aiden-header-actions">
            <button id="aiden-clear-btn" title="Clear chat">&#x21ba;</button>
            <button id="aiden-close-btn" title="Close">&times;</button>
          </div>
        </div>
        <div id="aiden-messages"></div>
        <div id="aiden-typing"><span>.</span><span>.</span><span>.</span></div>
        <div id="aiden-backend-info">
          <span id="aiden-backend-label">Running on <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a> (free community model)</span>
        </div>
        <div id="aiden-input-area">
          <div id="aiden-chips">
            ${isTrumpOS ? `
            <span class="aiden-chip" data-q="How do I install TrumpOS?">How to install?</span>
            <span class="aiden-chip" data-q="What makes TrumpOS the best Linux?">Why is it the best?</span>
            <span class="aiden-chip" data-q="My USB won't boot TrumpOS">USB not booting</span>
            <span class="aiden-chip" data-q="What are the system requirements for TrumpOS?">System requirements</span>
            ` : `
            <span class="aiden-chip" data-q="How do I install AcreetionOS?">How to install?</span>
            <span class="aiden-chip" data-q="What are the system requirements?">System requirements</span>
            <span class="aiden-chip" data-q="My USB won't boot">USB not booting</span>
            <span class="aiden-chip" data-q="How do I install NVIDIA drivers?">NVIDIA drivers</span>
            `}
          </div>
          <div id="aiden-input-row">
            <input id="aiden-input" type="text" placeholder="${BRAND.placeholder}" aria-label="Chat message">
            <button id="aiden-send" title="Send" aria-label="Send message">&#x27a4;</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(container);

    // ── Event bindings ──
    document.getElementById('aiden-bubble').addEventListener('click', togglePanel);
    document.getElementById('aiden-close-btn').addEventListener('click', closePanel);
    document.getElementById('aiden-clear-btn').addEventListener('click', clearChat);
    document.getElementById('aiden-send').addEventListener('click', sendMessage);
    document.getElementById('aiden-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendMessage();
    });
    document.querySelectorAll('.aiden-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.getElementById('aiden-input').value = this.dataset.q;
        sendMessage();
      });
    });
    const fbLink = document.getElementById('aiden-fallback-link');
    if (fbLink) {
      fbLink.style.display = 'none';
    }
  }

  // ── Panel controls ──
  function togglePanel() {
    var panel = document.getElementById('aiden-panel');
    var isOpen = panel.classList.contains('open');
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    document.getElementById('aiden-panel').classList.add('open');
    document.getElementById('aiden-bubble').style.display = 'none';
    document.getElementById('aiden-input').focus();
    scrollToBottom();
  }

  function closePanel() {
    document.getElementById('aiden-panel').classList.remove('open');
    document.getElementById('aiden-bubble').style.display = 'flex';
  }

  function clearChat() {
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    messageCount = 0;
    document.getElementById('aiden-messages').innerHTML = '';
    addGreeting();
  }

  // ── Messages ──
  function addGreeting() {
    var el = document.getElementById('aiden-messages');
    if (el.children.length === 0) {
      addMessage('ai', BRAND.greeting);
    }
  }

  function addMessage(role, text) {
    var el = document.getElementById('aiden-messages');
    var div = document.createElement('div');
    div.className = 'aiden-msg ' + role;
    div.innerHTML = text.replace(/\n/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>');
    el.appendChild(div);
    scrollToBottom();
  }

  function addError(text, retryFn) {
    var el = document.getElementById('aiden-messages');
    var div = document.createElement('div');
    div.className = 'aiden-msg error';
    if (retryFn) {
      div.innerHTML = text + ' <button class="aiden-retry-btn" onclick="arguments[0].stopPropagation();(' + retryFn.toString() + ')()">Retry</button>';
    } else {
      div.textContent = text;
    }
    el.appendChild(div);
    scrollToBottom();
  }

  function showTyping(show) {
    document.getElementById('aiden-typing').style.display = show ? 'block' : 'none';
    if (show) scrollToBottom();
  }

  function scrollToBottom() {
    var el = document.getElementById('aiden-messages');
    setTimeout(function () { el.scrollTop = el.scrollHeight; }, 50);
  }

  function updateBackendInfo(backend) {
    var label = document.getElementById('aiden-backend-label');
    var fallbackLink = document.getElementById('aiden-fallback-link');
    // Always show OpenRouter as the backend for transparency
    label.innerHTML = 'Running on <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a> (free community model)';
    if (backend === 'pollinations') {
      // Pollinations.ai has been retired from the widget
      fallbackLink.style.display = 'none';
    } else {
      fallbackLink.style.display = 'none';
    }
  }

  // ── Send message ──
  async function sendMessage() {
    var input = document.getElementById('aiden-input');
    var text = input.value.trim();
    if (!text || cooldown) return;
    input.value = '';
    cooldown = true;
    document.getElementById('aiden-send').disabled = true;

    addMessage('user', text);
    messages.push({ role: 'user', content: text });
    messageCount++;

    // Session cap warning
    if (messageCount >= SESSION_CAP) {
      addMessage('ai', 'You\'ve been chatting a lot! Consider checking our <a href="faq.html">FAQ</a> or <a href="wiki.html">Wiki</a> to ease load on community infrastructure. I\'m still here if you need me though!');
    }

    showTyping(true);

    try {
      var response = await callProxy();
      showTyping(false);
      messages.push({ role: 'assistant', content: response });
      addMessage('ai', response);
    } catch (err) {
      showTyping(false);
      console.error('AIDEN request error:', err);
      var msg = (err && err.message) ? err.message : 'AI request failed. Please try again.';
      addError(msg, retryLastMessage);
    }

    // Cooldown
    setTimeout(function () {
      cooldown = false;
      document.getElementById('aiden-send').disabled = false;
      document.getElementById('aiden-input').focus();
    }, COOLDOWN_MS);
  }

  // ── OpenRouter (direct, key obfuscated) ──
  async function callProxy() {
    var res;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + _k(),
          'HTTP-Referer': 'https://acreetionos.org',
          'X-Title': BRAND.name + ' (' + (isTrumpOS ? 'TrumpOS' : 'AcreetionOS') + ' Assistant)'
        },
        body: JSON.stringify({
          model: FREE_MODEL,
          messages: messages,
          max_tokens: 600,
          route: 'fallback'
        })
      });
    } catch (networkErr) {
      throw new Error('Network error — please check your connection and try again.');
    }

    var data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Invalid response from AI service');
    }

    if (!res.ok) {
      var errMsg = (data && data.error && data.error.message) ? data.error.message : ('AI error: HTTP ' + res.status);
      throw new Error(errMsg);
    }

    var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (content) return content;

    throw new Error('No response from AI model');
  }

  // ── Retry last message ──
  function retryLastMessage() {
    var msgs = document.getElementById('aiden-messages');
    var errors = msgs.querySelectorAll('.aiden-msg.error');
    errors.forEach(function(e) { e.remove(); });
    var lastUserIdx = -1;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx >= 0) {
      messages = messages.slice(0, lastUserIdx + 1);
      cooldown = false;
      document.getElementById('aiden-send').disabled = false;
      document.getElementById('aiden-input').value = messages[lastUserIdx].content;
      sendMessage();
    }
  }

  function switchToOpenRouter() {
    currentBackend = 'openrouter';
    updateBackendInfo('openrouter');
    addMessage('ai', 'Using OpenRouter (free community model).');
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (document.getElementById('aiden-chat')) return;
    createDOM();
    addGreeting();
    // Make sure the widget is mobile friendly: move bubble if viewport is small
    const bubble = document.getElementById('aiden-bubble');
    function positionBubble() {
      if (!bubble) return;
      if (window.innerWidth < 480) {
        bubble.style.right = '14px';
        bubble.style.bottom = '80px';
      } else {
        bubble.style.right = '30px';
        bubble.style.bottom = '30px';
      }
    }
    positionBubble();
    window.addEventListener('resize', positionBubble);
  }
})();
