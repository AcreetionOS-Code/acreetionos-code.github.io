// AIDEN — AcreetionOS AI Chat Widget
// Primary: OpenRouter via the site's Cloudflare Worker proxy (secure, key never in browser)
// Built mode: standalone (website) or Electron IPC (flasher app)

(function () {
  'use strict';

  // ── Configuration ──
  // Use OpenRouter via site proxy only. Pollinations.ai removed per request.
  const FALLBACK_PROXY = '/api/chat'; // Posts forwarded to origin/worker which uses OpenRouter
  const COOLDOWN_MS = 2500;
  const SESSION_CAP = 15;
  const TYPING_DELAY = 300;

  // ── Detect if running in Electron (flasher app) ──
  const isElectron = typeof window !== 'undefined' && window.process && window.process.type;

  // ── System prompt ──
  const pageTitle = document.title || 'AcreetionOS';
  const SYSTEM_PROMPT = `You are AIDEN, the official AI assistant for AcreetionOS Linux. Be friendly, concise, and helpful. Use only free community models available via OpenRouter fallback when necessary. When asked about your backend, mention that you use the site's OpenRouter-backed proxy.

Current page: ${pageTitle}. AcreetionOS is a user-friendly Arch-based Linux distribution featuring the Cinnamon desktop, XLibre display protocol, PipeWire audio, Pamac package manager, and AUR support. Installation is done via graphical Calamares installer. Boot uses systemd-boot/syslinux for live USB and GRUB for installed systems. Learn more at https://acreetionos.org.

Keep answers under 3 paragraphs unless the user asks for detail.`;

  let messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  let messageCount = 0;
  let cooldown = false;
  // currentBackend is now managed internally; default to 'openrouter'
  let currentBackend = 'openrouter';

  // ── DOM creation ──
  function createDOM() {
    const container = document.createElement('div');
    container.id = 'aiden-chat';
    container.innerHTML = `
      <button id="aiden-bubble" title="Chat with AIDEN" aria-label="Open AI chat">A</button>
      <div id="aiden-panel">
        <div id="aiden-header">
          <div id="aiden-header-title">
            <span id="aiden-status-dot"></span>
            <span>AIDEN</span>
          </div>
          <div id="aiden-header-actions">
            <button id="aiden-clear-btn" title="Clear chat">&#x21ba;</button>
            <button id="aiden-close-btn" title="Close">&times;</button>
          </div>
        </div>
        <div id="aiden-messages"></div>
        <div id="aiden-typing"><span>.</span><span>.</span><span>.</span></div>
        <div id="aiden-backend-info">
          <span id="aiden-backend-label">Running on <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a> (free community model via site proxy)</span>
        </div>
        <div id="aiden-input-area">
          <div id="aiden-chips">
            <span class="aiden-chip" data-q="How do I install AcreetionOS?">How to install?</span>
            <span class="aiden-chip" data-q="What are the system requirements?">System requirements</span>
            <span class="aiden-chip" data-q="My USB won't boot">USB not booting</span>
            <span class="aiden-chip" data-q="How do I install NVIDIA drivers?">NVIDIA drivers</span>
          </div>
          <div id="aiden-input-row">
            <input id="aiden-input" type="text" placeholder="Ask AIDEN anything about AcreetionOS..." aria-label="Chat message">
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
    // fallback link removed — openrouter-only configuration
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
      addMessage('ai', 'Hi! I\'m AIDEN, the AcreetionOS assistant. I use free community models via OpenRouter through the site\'s secure proxy. I can help with installation, troubleshooting, system specs, and anything AcreetionOS.');
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
    label.innerHTML = 'Running on <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a> (free community model via site proxy)';
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
      // Always use the site proxy (OpenRouter) for AI responses.
      var response = await callFallback();
      showTyping(false);
      messages.push({ role: 'assistant', content: response });
      addMessage('ai', response);
    } catch (err) {
      showTyping(false);
      // Surface server-provided error when available to help debugging (do not expose secrets)
      console.error('AIDEN request error:', err);
      var msg = (err && err.message) ? err.message : 'AI request failed — the site proxy or backend may be unreachable. Refresh and try again.';
      addError(msg, retryLastMessage);
    }

    // Cooldown
    setTimeout(function () {
      cooldown = false;
      document.getElementById('aiden-send').disabled = false;
      document.getElementById('aiden-input').focus();
    }, COOLDOWN_MS);
  }

  // Pollinations support removed. The client no longer calls external inference
  // services directly. callPollinations is deprecated.
  async function callPollinations() {
    throw new Error('Pollinations is deprecated in this widget');
  }

  // ── OpenRouter (via site proxy) ──
  async function callFallback() {
    var res;
    try {
      res = await fetch(FALLBACK_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, max_tokens: 600 })
      });
    } catch (networkErr) {
      throw new Error('Network error when contacting site proxy: ' + networkErr.message);
    }

    var text = await res.text();
    var data = null;
    try { data = JSON.parse(text); } catch (e) { /* non-json response */ }

    if (!res.ok) {
      var errMsg = (data && data.error) ? data.error : ('Fallback error: HTTP ' + res.status + ' - ' + (text || 'no details'));
      throw new Error(errMsg);
    }

    if (data && data.error) throw new Error(data.error);
    if (data && data.content) return data.content;

    // If server returned a plain string, use that
    if (typeof text === 'string' && text.trim().length) return text;

    throw new Error('Unexpected response from AI proxy');
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

  // Switch explicitly to the OpenRouter-backed proxy
  function switchToFallback() {
    currentBackend = 'openrouter';
    updateBackendInfo('openrouter');
    addMessage('ai', 'Using OpenRouter (free community model) via the site proxy.');
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
