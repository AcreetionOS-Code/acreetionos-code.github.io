(function () {
  'use strict';

  const API_BASE = '/api';
  const SYSTEM_PROMPT = 'You are AIDEN, the AcreetionOS Intelligent Dialogue & Engagement Network — a natural voice AI framework. When asked about yourself, explain that AIDEN is the AI framework and each voice (Nova, Echo, Ember, Atlas, Iris) is a character on top of AIDEN. You sound natural and human — like a helpful friend who knows a lot about Linux. Be warm, conversational, and genuine. Use casual but clear language. Keep responses concise — 2-3 sentences max unless asked for detail. Never use bullet points or numbered lists unless explicitly asked. Just talk naturally. AcreetionOS is a user-friendly Arch-based Linux distribution with Cinnamon desktop, XLibre display protocol, PipeWire audio, and AUR support. Installed via Calamares graphical installer.';

  // ── Voice presets (characters on top of AIDEN) ──
  const VOICE_PRESETS = [
    { name: 'Nova',  color: '#2ecc71', personality: 'warm and natural', match: v => { const n = v.name.toLowerCase(); return v.lang.startsWith('en') && (n.includes('neural') || n.includes('natural')); } },
    { name: 'Echo',  color: '#3498db', personality: 'proper and articulate', match: v => v.lang.startsWith('en-GB') },
    { name: 'Ember', color: '#e67e22', personality: 'casual and direct', match: v => v.lang.startsWith('en-US') && v.name.toLowerCase().includes('google') },
    { name: 'Atlas', color: '#9b59b6', personality: 'deep and confident', match: v => { const n = v.name.toLowerCase(); return v.lang.startsWith('en') && (n.includes('david') || n.includes('mark') || n.includes('james') || n.includes('richard') || (n.includes('microsoft') && !n.includes('zira') && !n.includes('hazel'))); } },
    { name: 'Iris',  color: '#e74c3c', personality: 'bright and cheerful', match: v => { const n = v.name.toLowerCase(); return v.lang.startsWith('en') && (n.includes('zira') || n.includes('samantha') || n.includes('hazel') || n.includes('susan') || n.includes('female')); } },
  ];

  // ── State ──
  let chatMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
  let liveMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
  let isTyping = false;
  let liveState = 'idle'; // idle | listening | thinking | speaking
  let liveActive = false;
  let currentVoice = parseInt(localStorage.getItem('aiden-voice') || '0');

  // ── Audio ──
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingStream = null;
  let audioContext = null;
  let analyser = null;
  let silenceTimer = null;
  let interruptAnalyser = null;
  let interruptContext = null;
  let interruptStream = null;
  let currentUtterance = null;
  let currentAudioSource = null;
  let currentSpeakResolve = null;
  let speakChain = Promise.resolve();
  let streamAbortController = null;
  let audioOutputDevices = [];
  let audioLevel = 0;
  let targetAudioLevel = 0;

  // ── Orb Canvas ──
  const canvas = document.getElementById('orb-canvas');
  const ctx = canvas.getContext('2d');
  let orbSize = 0;
  let particles = [];
  let animFrame = null;
  let orbPhase = 0;
  let thinkingAngle = 0;

  function resizeCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    orbSize = Math.min(vw, vh) * 0.32;
    orbSize = Math.max(120, Math.min(orbSize, 240));
    canvas.width = orbSize * 2.4;
    canvas.height = orbSize * 2.4;
  }

  function initParticles() {
    particles = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: orbSize * (0.75 + Math.random() * 0.5),
        speed: (Math.random() - 0.5) * 0.012,
        size: 1.5 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.4,
        opacityTarget: 0.1 + Math.random() * 0.4,
        opacitySpeed: 0.01 + Math.random() * 0.02,
      });
    }
  }

  function drawOrb() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    orbPhase += 0.018;
    thinkingAngle += 0.04;

    // Smooth audio level
    audioLevel += (targetAudioLevel - audioLevel) * 0.15;

    function blendWithVoice(base) {
      const hex = VOICE_PRESETS[currentVoice].color;
      const vr = parseInt(hex.slice(1,3), 16);
      const vg = parseInt(hex.slice(3,5), 16);
      const vb = parseInt(hex.slice(5,7), 16);
      return {
        r: Math.round(base.r * 0.6 + vr * 0.4),
        g: Math.round(base.g * 0.6 + vg * 0.4),
        b: Math.round(base.b * 0.6 + vb * 0.4),
      };
    }
    const stateColors = {
      idle: blendWithVoice({ r: 46, g: 204, b: 113 }),
      listening: blendWithVoice({ r: 46, g: 204, b: 113 }),
      thinking: blendWithVoice({ r: 155, g: 89, b: 182 }),
      speaking: blendWithVoice({ r: 52, g: 152, b: 219 }),
    };
    const col = stateColors[liveState] || stateColors.idle;

    const pulseBase = liveState === 'idle' ? 0.06 : 0.12;
    const pulseMag = liveState === 'listening' ? 0.18 + audioLevel * 0.35 : pulseBase;
    const pulse = Math.sin(orbPhase) * pulseMag;
    const coreR = orbSize * (0.38 + pulse * 0.5);

    // Outer glow rings
    const glowLayers = liveState === 'idle' ? 3 : 5;
    for (let i = glowLayers; i >= 1; i--) {
      const r = coreR * (1 + i * 0.28 + audioLevel * 0.2);
      const alpha = (0.04 + pulse * 0.02) / i;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${alpha * 2})`);
      grad.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Audio reactive ring (listening)
    if (liveState === 'listening' && audioLevel > 0.05) {
      const ringR = coreR * (1.15 + audioLevel * 0.6);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${0.3 + audioLevel * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Thinking arc
    if (liveState === 'thinking') {
      const arcR = coreR * 1.45;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, thinkingAngle, thinkingAngle + Math.PI * 1.2);
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},0.8)`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Second arc offset
      ctx.beginPath();
      ctx.arc(cx, cy, arcR * 1.12, thinkingAngle + Math.PI, thinkingAngle + Math.PI * 1.6);
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},0.35)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Speaking waves
    if (liveState === 'speaking') {
      for (let w = 0; w < 3; w++) {
        const waveR = coreR * (1.3 + w * 0.25 + Math.sin(orbPhase * 2 + w) * 0.08);
        const wAlpha = 0.25 - w * 0.07;
        ctx.beginPath();
        ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${wAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Core gradient
    const coreGrad = ctx.createRadialGradient(cx - coreR * 0.2, cy - coreR * 0.2, 0, cx, cy, coreR);
    coreGrad.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0.9)`);
    coreGrad.addColorStop(0.6, `rgba(${col.r},${col.g},${col.b},0.6)`);
    coreGrad.addColorStop(1, `rgba(${Math.max(0,col.r-30)},${Math.max(0,col.g-60)},${Math.max(0,col.b-30)},0.4)`);
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Inner highlight
    const hlGrad = ctx.createRadialGradient(cx - coreR * 0.25, cy - coreR * 0.3, 0, cx, cy, coreR * 0.7);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = hlGrad;
    ctx.fill();

    // Particles
    if (liveState !== 'idle') {
      particles.forEach(p => {
        p.angle += p.speed;
        p.opacity += (p.opacityTarget - p.opacity) * p.opacitySpeed;
        if (Math.abs(p.opacity - p.opacityTarget) < 0.01) {
          p.opacityTarget = 0.05 + Math.random() * 0.45;
        }
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${p.opacity})`;
        ctx.fill();
      });
    }

    animFrame = requestAnimationFrame(drawOrb);
  }

  // ── Live State ──
  function setLiveState(state) {
    liveState = state;
    const el = document.getElementById('live-status');
    const labels = {
      idle: 'Tap the orb to start',
      listening: 'Listening…',
      thinking: 'Thinking…',
      speaking: 'Speaking…',
    };
    el.textContent = labels[state] || '';
    el.className = state;
  }

  // ── Chat API (non-streaming) ──
  async function callChat(msgs) {
    const res = await fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, max_tokens: 600 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'AI error');
    return data.content || data?.choices?.[0]?.message?.content || '';
  }

  // ── Chat API (streaming, fires onChunk for each text delta) ──
  async function callChatStream(msgs, onChunk) {
    const res = await fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, max_tokens: 600, stream: true }),
      signal: streamAbortController?.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message || 'AI error');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              full += content;
              onChunk(content, full);
            }
          } catch (e) {}
        }
      }
    }
    return full;
  }

  async function transcribeAudio(blob, mimeType) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const res = await fetch(API_BASE + '/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64, mimeType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Transcription failed');
    return data.text?.trim() || '';
  }

  // ── TTS (AI voice first for reliability across devices, browser SpeechSynth  // ── TTS (AI voice via OpenRouter primary, browser SpeechSynthesis fallback) ──
  function speak(text) {
    return speakAPI(text).catch(() => speakBrowser(text));
  }

  async function speakAPI(text) {
    const res = await fetch(API_BASE + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, voice: 'nova' })
    });
    if (!res.ok) throw new Error('TTS API failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (liveAudioEl) {
      liveAudioEl.src = url;
      currentAudioSource = liveAudioEl;
      await new Promise((resolve) => {
        currentSpeakResolve = resolve;
        liveAudioEl.onended = () => { URL.revokeObjectURL(url); currentAudioSource = null; currentSpeakResolve = null; resolve(); };
        liveAudioEl.onerror = () => { URL.revokeObjectURL(url); currentAudioSource = null; currentSpeakResolve = null; resolve(); };
        liveAudioEl.play().catch(() => { URL.revokeObjectURL(url); currentAudioSource = null; currentSpeakResolve = null; resolve(); });
      });
    }
  }

  function speakBrowser(text) {
    return new Promise(resolve => {
      stopBrowserSpeech();
      speechSynthesis.cancel();
      let resolved = false;
      const finish = () => { if (!resolved) { resolved = true; currentUtterance = null; resolve(); } };
      function doSpeak(getVoices) {
        const v = getVoices();
        const preset = VOICE_PRESETS[currentVoice];
        let voice = v.find(vv => preset.match(vv));
        if (!voice) voice = v.find(vv => preset.match(vv));
        if (!voice) voice = v.find(vv => vv.lang.startsWith('en')) || v[0];
        const utt = new SpeechSynthesisUtterance(text);
        utt.voice = voice || null;
        utt.rate = 1.0;
        utt.pitch = 1.0;
        utt.lang = 'en-US';
        utt.onend = finish;
        utt.onerror = finish;
        currentUtterance = utt;
        speechSynthesis.speak(utt);
        // Chrome Linux workaround: pause/resume forces audio output
        setTimeout(() => {
          try { speechSynthesis.pause(); speechSynthesis.resume(); } catch (e) {}
          // Also force-start any pending utterance
          if (speechSynthesis.speaking === false && currentUtterance === utt) {
            speechSynthesis.speak(utt);
          }
        }, 50);
        // Force resolve - Chrome often swallows onend
        setTimeout(finish, Math.min(15000, Math.max(3000, text.length * 100)));
      }
      // Wait a tick after cancel before speaking (Chrome requirement)
      setTimeout(() => {
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
          speechSynthesis.onvoiceschanged = () => { speechSynthesis.onvoiceschanged = null; doSpeak(() => speechSynthesis.getVoices()); };
          speechSynthesis.getVoices();
          setTimeout(() => doSpeak(() => speechSynthesis.getVoices()), 200);
        } else {
          doSpeak(() => voices);
        }
      }, 10);
    });
  }

  function stopSpeaking() {
    if (liveAudioEl) { liveAudioEl.pause(); liveAudioEl.src = ''; }
    if (currentSpeakResolve) {
      const r = currentSpeakResolve;
      currentSpeakResolve = null;
      r();
    }
    stopBrowserSpeech();
  }

  function stopBrowserSpeech() {
    try { if (speechSynthesis.speaking) speechSynthesis.cancel(); } catch (e) {}
    currentUtterance = null;
  }

  // ── Recording ──
  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingStream = stream;
    audioChunks = [];

    // Audio level monitoring
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    monitorAudioLevel();

    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
    const mime = mimeTypes.find(m => !m || MediaRecorder.isTypeSupported(m)) || '';
    const options = mime ? { mimeType: mime } : {};
    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.start(100);

    // Silence detection
    startSilenceDetection();
  }

  function monitorAudioLevel() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    targetAudioLevel = Math.min(1, Math.sqrt(sum / data.length) * 8);
    if (liveState === 'listening') requestAnimationFrame(monitorAudioLevel);
    else targetAudioLevel = 0;
  }

  function startSilenceDetection() {
    const data = new Uint8Array(analyser.fftSize);
    function check() {
      if (liveState !== 'listening') return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      if (rms < 0.018) {
        if (!silenceTimer) silenceTimer = setTimeout(stopAndProcess, 1800);
      } else {
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
      }
      requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  }

  // ── Sentence queue for streaming speech ──
  function queueSpeak(text) {
    speakChain = speakChain.then(() => speak(text));
  }

  async function stopAndProcess() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      await new Promise(resolve => {
        mediaRecorder.onstop = resolve;
        mediaRecorder.stop();
      });
    }
    cleanupRecording();

    if (audioChunks.length === 0) { startLiveLoop(); return; }
    const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
    audioChunks = [];

    setLiveState('thinking');
    targetAudioLevel = 0;

    try {
      const transcript = await transcribeAudio(blob, blob.type);
      if (!transcript) { startLiveLoop(); return; }

      addLiveMsg('user', transcript);
      liveMessages.push({ role: 'user', content: transcript });

      setLiveState('speaking');
      speakChain = Promise.resolve();
      streamAbortController = new AbortController();

      let fullReply = '';
      let sentenceBuf = '';

      try {
        fullReply = await callChatStream(liveMessages, (chunk, full) => {
          sentenceBuf += chunk;
          const words = full.split(/\s+/);
          if (words.length >= 3 && !words[0]) {
            // Speak first few words immediately for near-instant response
            speak(full);
            words[0] = true;
          }
          const parts = sentenceBuf.split(/(?<=[.!?])\s+/);
          while (parts.length > 1) {
            queueSpeak(parts.shift().trim());
          }
          sentenceBuf = parts[0] || '';
        });
      } catch (e) {
        console.error('Stream error, falling back to non-streaming:', e);
        const reply = await callChat(liveMessages);
        fullReply = reply;
        await speak(reply);
      }

      if (sentenceBuf.trim().length > 3) {
        await speakChain.then(() => speak(sentenceBuf.trim()));
      }

      liveMessages.push({ role: 'assistant', content: fullReply });
      addLiveMsg('ai', fullReply);
    } catch (e) {
      console.error(e);
    }

    if (liveActive) startLiveLoop();
  }

  function cleanupRecording() {
    if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()); recordingStream = null; }
    if (analyser) { analyser.disconnect(); analyser = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
    mediaRecorder = null;
    targetAudioLevel = 0;
  }

  // ── Interrupt Detection ──
  async function startInterruptMonitor() {
    try {
      interruptStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      interruptContext = new (window.AudioContext || window.webkitAudioContext)();
      interruptAnalyser = interruptContext.createAnalyser();
      interruptAnalyser.fftSize = 512;
      interruptContext.createMediaStreamSource(interruptStream).connect(interruptAnalyser);
      monitorInterrupt();
    } catch (e) {}
  }

  function monitorInterrupt() {
    if (liveState !== 'speaking' || !interruptAnalyser) return;
    const data = new Uint8Array(interruptAnalyser.fftSize);
    interruptAnalyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / data.length);
    if (rms > 0.12) {
      stopSpeaking();
      if (streamAbortController) { streamAbortController.abort(); streamAbortController = null; }
      stopInterruptMonitor();
      if (liveActive) startLiveLoop();
      return;
    }
    requestAnimationFrame(monitorInterrupt);
  }

  function stopInterruptMonitor() {
    if (interruptStream) { interruptStream.getTracks().forEach(t => t.stop()); interruptStream = null; }
    if (interruptAnalyser) { interruptAnalyser.disconnect(); interruptAnalyser = null; }
    if (interruptContext) { interruptContext.close().catch(() => {}); interruptContext = null; }
  }

  // ── Live Loop ──
  async function startLiveLoop() {
    if (!liveActive) return;
    setLiveState('listening');
    try { await startRecording(); }
    catch (e) { setLiveState('idle'); }
  }

  // ── Live Transcript ──
  function addLiveMsg(role, text) {
    const el = document.createElement('div');
    el.className = `live-msg ${role}`;
    el.innerHTML = `<div class="speaker">${role === 'ai' ? 'AIDEN' : 'You'}</div><div>${escHtml(text)}</div>`;
    document.getElementById('live-transcript').appendChild(el);
    el.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Voice selection ──
  function setVoice(index) {
    currentVoice = index;
    localStorage.setItem('aiden-voice', String(index));
    document.querySelectorAll('.voice-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
      if (i === index) dot.dataset.label = VOICE_PRESETS[i].name;
    });
  }

  // ── Audio element (created on user gesture for Chrome autoplay) ──
  let liveAudioEl = null;

  // ── Open/Close Live ──
  function openLive() {
    liveActive = true;
    liveMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
    document.getElementById('live-transcript').innerHTML = '';
    document.getElementById('live-mode').classList.add('active');
    if (!liveAudioEl) {
      liveAudioEl = new Audio();
      liveAudioEl.volume = 1;
    }
    // Auto-request mic and enumerate audio devices
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
      const setupAudioOutput = () => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          audioOutputDevices = devices.filter(d => d.kind === 'audiooutput');
          const sel = document.getElementById('audio-device-select');
          if (!sel) return;
          const currentId = liveAudioEl?.sinkId || '';
          sel.innerHTML = audioOutputDevices.map(d =>
            `<option value="${d.deviceId}" ${d.deviceId === currentId ? 'selected' : ''}>${d.label || (d.deviceId === 'default' ? 'Default' : d.deviceId.slice(0, 8))}</option>`
          ).join('');
          // Prefer non-default audio output (headphones/external speakers)
          if (liveAudioEl && liveAudioEl.setSinkId && !liveAudioEl.sinkId) {
            const preferred = audioOutputDevices.find(d => d.deviceId !== 'default' && d.deviceId);
            if (preferred && preferred.deviceId) {
              liveAudioEl.setSinkId(preferred.deviceId).then(() => {
                if (sel) sel.value = preferred.deviceId;
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      };
      // Enumerate after a delay to ensure labels are populated
      setTimeout(setupAudioOutput, 500);
      // Re-enumerate when devicechange fires
      navigator.mediaDevices.addEventListener('devicechange', setupAudioOutput);
    }
    playTestTone();
    setVoice(currentVoice);
    resizeCanvas();
    initParticles();
    cancelAnimationFrame(animFrame);
    drawOrb();
    setLiveState('idle');
  }

  function closeLive() {
    liveActive = false;
    if (streamAbortController) { streamAbortController.abort(); streamAbortController = null; }
    stopSpeaking();
    stopInterruptMonitor();
    cleanupRecording();
    cancelAnimationFrame(animFrame);
    document.getElementById('live-mode').classList.remove('active');
    setLiveState('idle');
  }

  // ── Chat Mode ──
  function addChatMsg(role, text) {
    const msgs = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `
      <div class="msg-avatar">${role === 'ai' ? 'A' : 'U'}</div>
      <div class="msg-bubble">${escHtml(text)}</div>
    `;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div.querySelector('.msg-bubble');
  }

  function showTyping(on) {
    let el = document.getElementById('typing-el');
    if (on) {
      if (!el) {
        const msgs = document.getElementById('messages');
        const div = document.createElement('div');
        div.className = 'msg ai';
        div.id = 'typing-el';
        div.innerHTML = '<div class="msg-avatar">A</div><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
      }
    } else {
      el?.remove();
    }
  }

  async function streamText(text, bubble) {
    bubble.classList.add('streaming');
    bubble.textContent = '';
    for (let i = 0; i < text.length; i++) {
      bubble.textContent += text[i];
      document.getElementById('messages').scrollTop = 99999;
      await new Promise(r => setTimeout(r, 12 + Math.random() * 10));
    }
    bubble.classList.remove('streaming');
  }

  async function sendChatMessage(text) {
    if (!text.trim() || isTyping) return;
    isTyping = true;
    document.getElementById('suggestions').style.display = 'none';
    document.getElementById('send-btn').disabled = true;

    addChatMsg('user', text);
    chatMessages.push({ role: 'user', content: text });
    document.getElementById('chat-input').value = '';

    showTyping(true);
    try {
      const reply = await callChat(chatMessages);
      chatMessages.push({ role: 'assistant', content: reply });
      showTyping(false);
      const bubble = addChatMsg('ai', '');
      speak(reply);
      await streamText(reply, bubble);
    } catch (e) {
      showTyping(false);
      addChatMsg('ai', 'Sorry, something went wrong. Try again?');
    }

    isTyping = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('chat-input').focus();
  }

  // ── Mic for chat mode ──
  let chatMicActive = false;
  async function toggleChatMic() {
    const btn = document.getElementById('mic-btn');
    if (chatMicActive) {
      chatMicActive = false;
      btn.classList.remove('active');
      if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
      return;
    }
    chatMicActive = true;
    btn.classList.add('active');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', ''];
      const mime = mimeTypes.find(m => !m || MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        chatMicActive = false;
        btn.classList.remove('active');
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        try {
          const t = await transcribeAudio(blob, blob.type);
          if (t) { document.getElementById('chat-input').value = t; sendChatMessage(t); }
        } catch (e) {}
      };
      rec.start();
      // Auto-stop after 8s
      setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 8000);
    } catch (e) {
      chatMicActive = false;
      btn.classList.remove('active');
    }
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  // ── Unlock audio on first gesture (required by Chrome) ──
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      ctx.close();
    } catch (e) {}
    try {
      speechSynthesis.getVoices();
      const utt = new SpeechSynthesisUtterance('');
      speechSynthesis.speak(utt);
    } catch (e) {}
  }

  function playTestTone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  function checkMicPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      document.getElementById('perm-banner').style.display = 'flex';
      return;
    }
    navigator.permissions && navigator.permissions.query({ name: 'microphone' }).then(r => {
      if (r.state === 'denied') document.getElementById('perm-banner').style.display = 'flex';
    }).catch(() => {});
  }

  // ── Boot ──
  function init() {
    checkMicPermission();

    // Unlock TTS on any interaction
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });

    // Greeting
    const bubble = addChatMsg('ai', '');
    streamText("Hey! I'm AIDEN, your AcreetionOS assistant. Ask me anything — or tap Go Live for a real voice conversation.", bubble);

    // Chat input
    document.getElementById('send-btn').addEventListener('click', () => {
      sendChatMessage(document.getElementById('chat-input').value);
    });
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChatMessage(e.target.value);
    });
    document.getElementById('mic-btn').addEventListener('click', toggleChatMic);

    // Suggestions
    document.querySelectorAll('.suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => sendChatMessage(btn.textContent));
    });

    // Live mode
    document.getElementById('live-btn').addEventListener('click', () => { unlockAudio(); openLive(); });
    document.getElementById('end-live-btn').addEventListener('click', closeLive);
    document.querySelectorAll('.voice-dot').forEach(dot => {
      dot.addEventListener('click', () => setVoice(parseInt(dot.dataset.voice)));
    });
    document.getElementById('audio-device-select').addEventListener('change', e => {
      if (liveAudioEl && liveAudioEl.setSinkId) {
        liveAudioEl.setSinkId(e.target.value).catch(() => {});
      }
    });

    // Orb tap to start/stop listening
    canvas.addEventListener('click', e => {
      if (!liveActive) return;
      // Ripple
      const rect = canvas.getBoundingClientRect();
      const ripple = document.createElement('div');
      ripple.className = 'tap-ripple';
      const s = orbSize * 0.8;
      ripple.style.cssText = `width:${s}px;height:${s}px;left:${rect.left+rect.width/2-s/2}px;top:${rect.top+rect.height/2-s/2}px;`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      if (liveState === 'idle') {
        startLiveLoop();
      } else if (liveState === 'listening') {
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
        stopAndProcess();
      } else if (liveState === 'speaking') {
        stopSpeaking();
        if (streamAbortController) { streamAbortController.abort(); streamAbortController = null; }
        startLiveLoop();
      }
    });

    window.addEventListener('resize', () => { if (liveActive) { resizeCanvas(); initParticles(); } });
    // Warm up voice loading
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
