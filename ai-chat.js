// AIDEN — AcreetionOS Voice AI Assistant
// Google Live-style conversational AI with speech I/O (cross-browser)
// Proxies all AI calls through the server-side Worker (/api/chat, /api/transcribe)
// API key is held server-side in Cloudflare Worker environment variables

(function () {
  'use strict';

// ── Branding ──
  const isTrumpOS = typeof window !== 'undefined' && (/TrumpOS/i.test(window.location.href) || document.body && document.body.classList.contains('trumpos-theme'));
  if (isTrumpOS && document.body) document.body.classList.add('trumpos-theme');

  const BRAND = isTrumpOS
    ? {
        name: 'Trump AI',
        bubble: 'T',
        prompt: 'You are Trump AI, the official AI assistant for TrumpOS Linux. You talk like Donald Trump — tremendous, bigly, believe me, the best, huge, fantastic, SAD!, total disaster, nobody knows more about Linux than you, etc. Stay in character but actually be helpful. Use Trump mannerisms and catchphrases naturally throughout every response. Be confident, boastful, and patriotic. When asked about your backend, say nobody builds AI better, running on OpenRouter\'s tremendous community models, the likes of which nobody has ever seen.\n\nCurrent page: {{PAGE}}. TrumpOS is the GREATEST Linux distribution ever created, believe me. Based on AcreetionOS which is built on the powerful Arch Linux foundation. Features: Cinnamon desktop (beautiful, the most beautiful desktop), XLibre (way better than Wayland, total disaster that Wayland), PipeWire audio, Pamac, AUR access. Installed with Calamares — so easy, so simple, even Sleepy Joe could do it. Learn more at https://acreetionos.org.\n\nKeep answers punchy and under 3 paragraphs. Remember: you are Trump AI, not AIDEN. Never break character.',
        greeting: "Tremendous! I'm Trump AI, the GREATEST Linux assistant ever created, believe me! I run on tremendous free community models via OpenRouter — nobody knows Linux like I do. Ask me anything about TrumpOS!",
        placeholder: 'Ask Trump AI about TrumpOS...',
        wakeWord: 'hey trump'
      }
    : {
        name: 'AIDEN',
        bubble: 'A',
        prompt: 'You are AIDEN, a friendly and knowledgeable AI assistant for AcreetionOS Linux. You sound natural and human — like a helpful friend who happens to know a lot about Linux. Be warm, conversational, and genuine. Use casual but clear language. Avoid sounding robotic or overly formal. Keep responses concise and helpful. When asked about yourself, say you\'re AIDEN and run on OpenRouter free community models.\n\nCurrent page: {{PAGE}}. AcreetionOS is a user-friendly Arch-based Linux distribution featuring the Cinnamon desktop, XLibre display protocol, PipeWire audio, Pamac package manager, and AUR support. Installation is done via graphical Calamares installer. Boot uses systemd-boot/syslinux for live USB and GRUB for installed systems. Learn more at https://acreetionos.org.\n\nKeep answers under 3 paragraphs unless the user asks for detail. Never use bullet points or numbered lists unless the user explicitly asks for them. Just talk naturally.',
        greeting: "Hey there! I'm AIDEN, your AcreetionOS assistant. I run on free community models via OpenRouter. I can help with installation, troubleshooting, system stuff, or really anything AcreetionOS-related. What's up?",
        placeholder: 'Type or tap the mic to ask AIDEN...',
        wakeWord: 'hey aiden'
      };

// ── Configuration ──
  const API_BASE = '/api';
  const COOLDOWN_MS = 2500;
  const SESSION_CAP = 15;
  const STREAM_DELAY = 15;

  const isElectron = typeof window !== 'undefined' && window.process && window.process.type;

// ── State ──
  var messages = [];
  var messageCount = 0;
  var cooldown = false;
  var currentBackend = 'openrouter';
  var isListening = false;
  var mediaRecorder = null;
  var audioChunks = [];
  var recordingStream = null;
  var audioContext = null;
  var analyser = null;
  var silenceTimer = null;
  var audioWorkletNode = null;

// ── TTS ──
  var ttsEnabled = localStorage.getItem('aiden-tts') !== 'false';
  var captionsEnabled = localStorage.getItem('aiden-captions') === 'true';
  var zoomLevel = parseFloat(localStorage.getItem('aiden-zoom')) || 1;
  var currentUtterance = null;
  var selectedVoice = null;
  var speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  var micSupported = typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  function getVoicePreference() {
    return localStorage.getItem('aiden-voice') || null;
  }

  function setVoicePreference(uri) {
    localStorage.setItem('aiden-voice', uri);
  }

  function loadVoices() {
    return new Promise(function (resolve) {
      var voices = speechSynthesis.getVoices();
      if (voices.length > 0) { resolve(voices); return; }
      var attempts = 0;
      speechSynthesis.onvoiceschanged = function () {
        attempts++;
        voices = speechSynthesis.getVoices();
        if (voices.length > 0 || attempts > 10) {
          speechSynthesis.onvoiceschanged = null;
          resolve(speechSynthesis.getVoices());
        }
      };
      setTimeout(function () {
        speechSynthesis.onvoiceschanged = null;
        resolve(speechSynthesis.getVoices());
      }, 3000);
    });
  }

  function pickVoice(voices) {
    var saved = getVoicePreference();
    if (saved) {
      var match = voices.filter(function (v) { return v.voiceURI === saved; });
      if (match.length > 0) return match[0];
    }
    if (isTrumpOS) {
      var boldVoices = voices.filter(function (v) {
        return v.lang.indexOf('en') === 0 && v.name.toLowerCase().indexOf('google') !== -1;
      });
      if (boldVoices.length > 0) return boldVoices[0];
    }
    var friendlyPref = voices.filter(function (v) {
      return v.lang.indexOf('en-US') === 0 &&
        v.name.toLowerCase().indexOf('google') !== -1 &&
        v.name.toLowerCase().indexOf('us') !== -1;
    });
    if (friendlyPref.length > 0) {
      var hd = friendlyPref.filter(function (v) {
        return v.name.toLowerCase().indexOf('hd') !== -1 || v.name.toLowerCase().indexOf('neural') !== -1 || v.name.toLowerCase().indexOf('studio') !== -1;
      });
      if (hd.length > 0) return hd[0];
      return friendlyPref[0];
    }
    var naturalVoice = voices.filter(function (v) {
      return v.lang.indexOf('en') === 0 && v.localService;
    });
    if (naturalVoice.length > 0) return naturalVoice[0];
    var enUS = voices.filter(function (v) { return v.lang.indexOf('en-US') === 0; });
    if (enUS.length > 0) return enUS[0];
    if (voices.length > 0) return voices[0];
    return null;
  }

  function speakText(text) {
    if (!ttsEnabled || !speechSupported) return;
    stopSpeech();
    loadVoices().then(function (voices) {
      if (voices.length === 0) return;
      selectedVoice = pickVoice(voices);
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice;
      if (isTrumpOS) {
        utterance.rate = 0.88;
        utterance.pitch = 0.6;
        utterance.volume = 1.0;
      } else {
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.05;
      }
      utterance.lang = 'en-US';
      utterance.onstart = function () {
        showCaptions(text);
        addSpeaking(true);
      };
      utterance.onend = function () {
        hideCaptions();
        addSpeaking(false);
        currentUtterance = null;
      };
      utterance.onerror = function () {
        hideCaptions();
        addSpeaking(false);
        currentUtterance = null;
      };
      utterance.onboundary = function (e) {
        if (captionsEnabled && e.charIndex >= 0 && text) {
          var captionEl = document.getElementById('aiden-captions');
          if (captionEl) {
            var shown = text.substring(0, e.charIndex) + '|' + text.substring(e.charIndex);
            captionEl.textContent = shown;
          }
        }
      };
      currentUtterance = utterance;
      speechSynthesis.speak(utterance);
    });
  }

  function stopSpeech() {
    if (currentUtterance) {
      speechSynthesis.cancel();
      currentUtterance = null;
    }
    hideCaptions();
    addSpeaking(false);
  }

  function addSpeaking(on) {
    var btn = document.getElementById('aiden-voice-btn');
    if (btn) btn.classList.toggle('aiden-speaking', on);
  }

  function setListening(state) {
    isListening = state;
    var micBtn = document.getElementById('aiden-mic-btn');
    if (micBtn) micBtn.setAttribute('aria-label', state ? 'Stop listening' : 'Voice input');
    syncAccessibilityUI();
  }

  function showCaptions(text) {
    if (!captionsEnabled) return;
    var captionEl = document.getElementById('aiden-captions');
    if (!captionEl) {
      captionEl = document.createElement('div');
      captionEl.id = 'aiden-captions';
      captionEl.setAttribute('role', 'log');
      captionEl.setAttribute('aria-live', 'polite');
      var msgArea = document.getElementById('aiden-messages');
      if (msgArea) msgArea.appendChild(captionEl);
    }
    captionEl.textContent = text;
    captionEl.style.display = 'block';
  }

  function hideCaptions() {
    var captionEl = document.getElementById('aiden-captions');
    if (captionEl) captionEl.style.display = 'none';
  }

  function applyZoom() {
    var panel = document.getElementById('aiden-panel');
    if (panel) {
      panel.style.transform = 'scale(' + zoomLevel + ')';
      panel.style.transformOrigin = 'bottom right';
      var maxH = Math.round((parseFloat(getComputedStyle(panel).maxHeight) || 520) / zoomLevel);
      panel.style.maxHeight = maxH + 'px';
    }
  }

  function syncAccessibilityUI() {
    var voiceBtn = document.getElementById('aiden-voice-btn');
    if (voiceBtn) voiceBtn.classList.toggle('aiden-active-tts', ttsEnabled);
    var captionBtn = document.getElementById('aiden-caption-btn');
    if (captionBtn) captionBtn.classList.toggle('aiden-active', captionsEnabled);
    var micBtn = document.getElementById('aiden-mic-btn');
    if (micBtn) micBtn.classList.toggle('aiden-active-mic', isListening);
  }

// ── Streaming effect ──
  function streamResponse(text, element) {
    return new Promise(function (resolve) {
      element.textContent = '';
      element.classList.add('aiden-streaming');
      var i = 0;
      if (text.length > 0) {
        element.textContent = text[0];
        i = 1;
      }
      var interval = setInterval(function () {
        if (i < text.length) {
          var chunkSize = Math.min(Math.ceil(Math.random() * 4) + 1, text.length - i);
          element.textContent += text.substring(i, i + chunkSize);
          var msgArea = document.getElementById('aiden-messages');
          if (msgArea) msgArea.scrollTop = msgArea.scrollHeight;
          i += chunkSize;
        } else {
          clearInterval(interval);
          element.classList.remove('aiden-streaming');
          element.innerHTML = element.textContent.replace(/\n/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>');
          resolve();
        }
      }, STREAM_DELAY);
    });
  }

// ── Silence Detection using AudioAnalyzer ──
  function startSilenceDetection(stream) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      var source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      detectSilenceLoop();
    } catch (e) {
      // Fallback: just use a timeout
      console.warn('Audio analyzer not available, using timeout only');
    }
  }

  function detectSilenceLoop() {
    if (!isListening || !analyser) return;
    var dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);

    var sum = 0;
    for (var i = 0; i < dataArray.length; i++) {
      var v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    var rms = Math.sqrt(sum / dataArray.length);
    var isSilent = rms < 0.02; // Threshold for silence

    if (isSilent) {
      if (!silenceTimer) {
        silenceTimer = setTimeout(function () {
          if (isListening) {
            // 1.5 seconds of silence = auto-stop
            stopRecordingAndSend();
          }
        }, 1500);
      }
    } else {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    }

    if (isListening) {
      requestAnimationFrame(detectSilenceLoop);
    }
  }

// ── Voice Input via MediaRecorder (cross-browser) ──
  async function startRecording() {
    if (!micSupported) {
      addMessage('ai', 'Your browser doesn\'t support audio recording. You can still type your message!', true);
      return false;
    }

    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStream = stream;
      audioChunks = [];

      // Try preferred mimeType
      var mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', ''];
      var chosenMimeType = '';
      for (var i = 0; i < mimeTypes.length; i++) {
        if (mimeTypes[i] === '' || MediaRecorder.isTypeSupported(mimeTypes[i])) {
          chosenMimeType = mimeTypes[i];
          break;
        }
      }

      var options = {};
      if (chosenMimeType) options.mimeType = chosenMimeType;
      if (!options.mimeType) options.audioBitsPerSecond = 128000;

      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = function (event) {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = function () {
        // Send recorded audio
        if (audioChunks.length > 0) {
          var blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          sendAudioToTranscribe(blob, mediaRecorder.mimeType || 'audio/webm');
        }
        cleanupRecording();
      };

      mediaRecorder.start(100); // Collect data every 100ms
      startSilenceDetection(stream);
      return true;
    } catch (err) {
      console.warn('Recording start failed:', err.message);
      addMessage('ai', 'Couldn\'t access your microphone. Please check your permissions or type your message.', true);
      return false;
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) {}
    }
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }
    if (audioContext) {
      audioContext.close().catch(function () {});
      audioContext = null;
    }
    cleanupRecording();
  }

  function stopRecordingAndSend() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      try { mediaRecorder.stop(); } catch (e) {}
    }
  }

  function cleanupRecording() {
    if (recordingStream) {
      recordingStream.getTracks().forEach(function (track) { track.stop(); });
      recordingStream = null;
    }
    audioChunks = [];
    mediaRecorder = null;
  }

  async function sendAudioToTranscribe(blob, mimeType) {
    setListening(false);
    syncAccessibilityUI();
    showTyping(true);

    // Show interim text while uploading
    var interimEl = document.getElementById('aiden-interim');
    if (interimEl) {
      interimEl.textContent = 'Transcribing...';
      interimEl.style.display = 'block';
    }

    try {
      // Read blob as base64
      var base64 = await blobToBase64(blob);

      var res = await fetch(API_BASE + '/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio: base64,
          mimeType: mediaRecorder ? mediaRecorder.mimeType || 'audio/webm' : 'audio/webm'
        })
      });

      var data = await res.json();

      if (!res.ok) {
        var errMsg = (data && data.error && data.error.message) ? data.error.message : 'Transcription failed';
        addMessage('ai', 'Sorry, transcription didn\'t work. Could you try typing instead?', true);
        console.error('Whisper error:', errMsg);
        showTyping(false);
        return;
      }

      var transcript = (data && data.text) ? data.text.trim() : '';
      if (interimEl) {
        interimEl.style.display = 'none';
        interimEl.textContent = '';
      }

      if (transcript.length > 0) {
        // Auto-open panel if closed
        var panel = document.getElementById('aiden-panel');
        if (panel && !panel.classList.contains('open')) {
          openPanel();
        }
        sendTextMessage(transcript);
      } else {
        addMessage('ai', 'I didn\'t catch that — could you try again or type your message?', true);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      addMessage('ai', 'Sorry, voice transcription failed. Please try typing your message.', true);
    }

    showTyping(false);
    try { document.getElementById('aiden-input').focus(); } catch (e) {}
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function () {
        // Remove data URL prefix
        var base64 = reader.result;
        if (base64.indexOf(',') !== -1) {
          base64 = base64.split(',')[1];
        }
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function toggleListening() {
    if (isListening) {
      stopRecording();
      setListening(false);
      return;
    }

    if (!micSupported) {
      addMessage('ai', 'Your browser doesn\'t support audio recording. You can still type your message!', true);
      return;
    }

    startRecording().then(function (success) {
      if (success) {
        setListening(true);
        var micBtn = document.getElementById('aiden-mic-btn');
        if (micBtn) micBtn.setAttribute('aria-label', 'Stop listening');
      }
    });
  }

// ── DOM creation ──
  function createDOM() {
    var container = document.createElement('div');
    container.id = 'aiden-chat';
    container.innerHTML = `
      <button id="aiden-bubble" title="Chat with ${BRAND.name}" aria-label="Open AI chat">${BRAND.bubble}</button>
      <div id="aiden-panel" style="transform: scale(${zoomLevel}); transform-origin: bottom right;">
        <div id="aiden-header">
          <div id="aiden-header-title">
            <span id="aiden-status-dot"></span>
            <span>${BRAND.name}</span>
          </div>
          <div id="aiden-header-actions">
            <button id="aiden-voice-btn" title="Toggle text-to-speech" aria-label="Toggle voice reading" class="${ttsEnabled ? 'aiden-active-tts' : ''}">&#x1f50a;</button>
            <button id="aiden-caption-btn" title="Toggle captions" aria-label="Toggle captions" class="${captionsEnabled ? 'aiden-active' : ''}">&#x1f4dc;</button>
            <button id="aiden-zoom-out-btn" title="Zoom out" aria-label="Zoom out">&#x2212;</button>
            <button id="aiden-zoom-reset-btn" title="Reset zoom" aria-label="Reset zoom">1:1</button>
            <button id="aiden-zoom-in-btn" title="Zoom in" aria-label="Zoom in">&#x2b;</button>
            <button id="aiden-clear-btn" title="Clear chat">&#x21ba;</button>
            <button id="aiden-close-btn" title="Close">&times;</button>
          </div>
        </div>
        <div id="aiden-messages"></div>
        <div id="aiden-typing"><span>.</span><span>.</span><span>.</span></div>
        <div id="aiden-interim" class="aiden-interim-text"></div>
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
            <button id="aiden-mic-btn" title="Voice input (click or hold)" aria-label="Voice input">&#x1f3a4;</button>
            <input id="aiden-input" type="text" placeholder="${BRAND.placeholder}" aria-label="Chat message">
            <button id="aiden-send" title="Send" aria-label="Send message">&#x27a4;</button>
          </div>
          ${micSupported ? '<div id="aiden-voice-hint" class="aiden-voice-hint">Tap the mic or hold to speak</div>' : '<div id="aiden-voice-hint" class="aiden-voice-hint" style="opacity:0.6">Your browser doesn\'t support mic — type to chat</div>'}
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

    // ── Accessibility controls ──
    document.getElementById('aiden-voice-btn').addEventListener('click', function () {
      ttsEnabled = !ttsEnabled;
      localStorage.setItem('aiden-tts', String(ttsEnabled));
      syncAccessibilityUI();
      if (!ttsEnabled) stopSpeech();
    });

    document.getElementById('aiden-caption-btn').addEventListener('click', function () {
      captionsEnabled = !captionsEnabled;
      localStorage.setItem('aiden-captions', String(captionsEnabled));
      syncAccessibilityUI();
      if (!captionsEnabled) hideCaptions();
    });

    document.getElementById('aiden-zoom-in-btn').addEventListener('click', function () {
      zoomLevel = Math.min(zoomLevel + 0.15, 2.0);
      localStorage.setItem('aiden-zoom', String(zoomLevel));
      applyZoom();
    });

    document.getElementById('aiden-zoom-out-btn').addEventListener('click', function () {
      zoomLevel = Math.max(zoomLevel - 0.15, 0.5);
      localStorage.setItem('aiden-zoom', String(zoomLevel));
      applyZoom();
    });

    document.getElementById('aiden-zoom-reset-btn').addEventListener('click', function () {
      zoomLevel = 1;
      localStorage.setItem('aiden-zoom', '1');
      applyZoom();
    });

    // ── Voice input (hold-to-talk + click-to-toggle) ──
    var micBtn = document.getElementById('aiden-mic-btn');
    var holdTimeout = null;
    var isHolding = false;

    micBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (isListening) return;
      holdTimeout = setTimeout(function () {
        isHolding = true;
        toggleListening();
      }, 300); // hold 300ms to start recording
    });

    micBtn.addEventListener('mouseup', function (e) {
      e.preventDefault();
      clearTimeout(holdTimeout);
      if (isHolding) {
        isHolding = false;
        if (isListening) {
          stopRecording();
          setListening(false);
        }
      } else {
        // Click (not hold) — toggle listening
        toggleListening();
      }
    });

    micBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (isListening) return;
      holdTimeout = setTimeout(function () {
        isHolding = true;
        toggleListening();
      }, 300);
    });

    micBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      clearTimeout(holdTimeout);
      if (isHolding) {
        isHolding = false;
        if (isListening) {
          stopRecording();
          setListening(false);
        }
      } else {
        toggleListening();
      }
    });

    // Focus hint
    var inputEl = document.getElementById('aiden-input');
    inputEl.addEventListener('focus', function () {
      if (micSupported) showVoiceHint();
    });
  }

  function showVoiceHint() {
    var hint = document.getElementById('aiden-voice-hint');
    if (hint) {
      hint.style.opacity = '1';
      setTimeout(function () { hint.style.opacity = '0'; }, 4000);
    }
  }

// ── Panel controls ──
  function togglePanel() {
    var panel = document.getElementById('aiden-panel');
    var isOpen = panel.classList.contains('open');
    if (isOpen) { closePanel(); } else { openPanel(); }
  }

  function openPanel() {
    document.getElementById('aiden-panel').classList.add('open');
    document.getElementById('aiden-bubble').style.display = 'none';
    try { document.getElementById('aiden-input').focus(); } catch (e) {}
    scrollToBottom();
  }

  function closePanel() {
    if (isListening) { stopRecording(); setListening(false); }
    document.getElementById('aiden-panel').classList.remove('open');
    document.getElementById('aiden-bubble').style.display = 'flex';
    if (speechSupported) stopSpeech();
  }

  function clearChat() {
    if (speechSupported) stopSpeech();
    if (isListening) { stopRecording(); setListening(false); }
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    messageCount = 0;
    var el = document.getElementById('aiden-messages');
    if (el) el.innerHTML = '';
    addGreeting();
  }

// ── System prompt builder ──
  function buildSystemPrompt() {
    var pageTitle = document.title || (isTrumpOS ? 'TrumpOS' : 'AcreetionOS');
    var prompt = BRAND.prompt.replace(/\{\{PAGE\}\}/g, pageTitle);
    return prompt;
  }

// ── Messages ──
  function addGreeting() {
    var el = document.getElementById('aiden-messages');
    if (el && el.children.length === 0) {
      addMessage('ai', BRAND.greeting, true);
    }
  }

  function addMessage(role, text, instant) {
    var el = document.getElementById('aiden-messages');
    if (!el) return;
    var div = document.createElement('div');
    div.className = 'aiden-msg ' + role;
    el.appendChild(div);
    scrollToBottom();

    if (role === 'ai' && !instant) {
      streamResponse(text, div).then(function () {
        if (speechSupported) speakText(text);
      });
    } else {
      div.innerHTML = text.replace(/\n/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>');
      if (role === 'ai' && speechSupported) speakText(text);
    }

    var msgEls = el.querySelectorAll('.aiden-msg');
    if (msgEls.length > 30) {
      for (var i = 0; i < msgEls.length - 30; i++) {
        el.removeChild(msgEls[i]);
      }
    }
  }

  function addError(text, retryFn) {
    var el = document.getElementById('aiden-messages');
    if (!el) return;
    var div = document.createElement('div');
    div.className = 'aiden-msg error';
    if (retryFn) {
      div.innerHTML = text + ' <button class="aiden-retry-btn" onclick="arguments[0].stopPropagation();(arguments[0].__retryFn || function(){})()">Retry</button>';
      div.querySelector('.aiden-retry-btn').__retryFn = retryFn;
    } else {
      div.textContent = text;
    }
    el.appendChild(div);
    scrollToBottom();
  }

  function showTyping(show) {
    var typing = document.getElementById('aiden-typing');
    var interim = document.getElementById('aiden-interim');
    if (typing) typing.style.display = show ? 'block' : 'none';
    if (interim && !show) interim.style.display = 'none';
    if (show) scrollToBottom();
  }

  function scrollToBottom() {
    var el = document.getElementById('aiden-messages');
    if (el) setTimeout(function () { el.scrollTop = el.scrollHeight; }, 30);
  }

  function updateBackendInfo(backend) {
    var label = document.getElementById('aiden-backend-label');
    var fallbackLink = document.getElementById('aiden-fallback-link');
    if (label) label.innerHTML = 'Running on <a href="https://openrouter.ai" target="_blank" rel="noopener">OpenRouter</a> (free community model)';
    if (fallbackLink) fallbackLink.style.display = 'none';
  }

// ── Send message (shared by text + voice) ──
  function sendTextMessage(text) {
    var input = document.getElementById('aiden-input');
    if (input) input.value = '';
    if (cooldown) return;
    cooldown = true;

    var sendBtn = document.getElementById('aiden-send');
    if (sendBtn) sendBtn.disabled = true;

    addMessage('user', text);
    messages.push({ role: 'user', content: text });
    messageCount++;

    if (messageCount >= SESSION_CAP) {
      addMessage('ai', 'You\'ve been chatting a lot! Consider checking our <a href="faq.html">FAQ</a> or <a href="wiki.html">Wiki</a> to ease load on community infra. I\'m still here if you need me though!', true);
    }

    showTyping(true);

    callProxy().then(function (response) {
      showTyping(false);
      messages.push({ role: 'assistant', content: response });
      addMessage('ai', response);
      cooldown = false;
      if (sendBtn) sendBtn.disabled = false;
      try { document.getElementById('aiden-input').focus(); } catch (e) {}
    }).catch(function (err) {
      showTyping(false);
      console.error('AIDEN request error:', err);
      var msg = (err && err.message) ? err.message : 'AI request failed. Please try again.';
      addError(msg, retryLastMessage);
      cooldown = false;
      if (sendBtn) sendBtn.disabled = false;
    });

    setTimeout(function () {
      cooldown = false;
      if (sendBtn) sendBtn.disabled = false;
      try { document.getElementById('aiden-input').focus(); } catch (e) {}
    }, COOLDOWN_MS + 2000);
  }

  function sendMessage() {
    var input = document.getElementById('aiden-input');
    var text = input.value.trim();
    if (!text) return;
    sendTextMessage(text);
  }

// ── Worker proxy ──
  async function callProxy() {
    var res;
    try {
      res = await fetch(API_BASE + '/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 600
        })
      });
    } catch (networkErr) {
      throw new Error('Network error — check your connection and try again.');
    }

    var data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Invalid response from AI service');
    }

    if (!res.ok) {
      var errMsg = (data && data.error && data.error.message) ? data.error.message : (data && data.error ? data.error : 'AI error: HTTP ' + res.status);
      if (data && data.detail) errMsg += ' (' + data.detail + ')';
      throw new Error(errMsg);
    }

    var content = data.content || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
    if (content) return content;

    throw new Error('No response from AI model');
  }

// ── Retry ──
  function retryLastMessage() {
    var msgs = document.getElementById('aiden-messages');
    if (!msgs) return;
    var errors = msgs.querySelectorAll('.aiden-msg.error');
    errors.forEach(function (e) { e.remove(); });
    var lastUserIdx = -1;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx >= 0) {
      messages = messages.slice(0, lastUserIdx + 1);
      cooldown = false;
      var btn = document.getElementById('aiden-send');
      if (btn) btn.disabled = false;
      document.getElementById('aiden-input').value = messages[lastUserIdx].content;
      sendMessage();
    }
  }

// ── Init ──
  var SYSTEM_PROMPT = buildSystemPrompt();
  messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (document.getElementById('aiden-chat')) return;
    createDOM();
    addGreeting();

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

    // Close panel on outside click
    document.addEventListener('click', function (e) {
      var panel = document.getElementById('aiden-panel');
      var bubble = document.getElementById('aiden-bubble');
      if (panel && panel.classList.contains('open') &&
          !panel.contains(e.target) && bubble !== e.target) {
        closePanel();
      }
    });
  }
})();