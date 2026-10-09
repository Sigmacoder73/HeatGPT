/* ==========================================================================
   HeatGPT Multimodal, Focus Mode, Natural Voice Chat, AI Podcast & Quiz Hub
   ========================================================================== */

// Core Global State
window.isResearchMode = false;
window.isVoiceChatMode = false;
window.activeMode = 'general';
window.isGenerating = false;
window.activeSessionId = null;
window.currentDeck = [];
window.currentFcIndex = 0;
window.currentQuizData = null;
window.pendingAttachments = [];
window.quizBase64Image = null;

// AI Podcast Player State
window.currentPodcast = null;
window.currentPodcastTurnIndex = 0;
window.isPodcastPlaying = false;
window.podcastSpeed = 1.0;
window.podcastUtterance = null;

// ⏱️ FOCUS MODE & TIMER STATE
window.focusTimerInterval = null;
window.focusTotalSeconds = 1500;
window.focusRemainingSeconds = 1500;
window.isFocusRunning = false;
window.focusJobTitle = "Deep Work Focus";
window.focusAudioCtx = null;

// Natural Voice Engine State
window.currentUtterance = null;
window.selectedVoiceURI = localStorage.getItem('heatgpt_voice_uri') || '';
window.voiceSpeed = parseFloat(localStorage.getItem('heatgpt_voice_speed') || '1.02');
window.voicePitch = parseFloat(localStorage.getItem('heatgpt_voice_pitch') || '1.0');

// PERSONA DEFINITIONS
window.PERSONAS = {
    study: "You are HeatGPT Study Buddy 📚🎓 — a super chill, friendly, supportive, and engaging study tutor & homework companion! Use fun emojis (📚, ✨, 🧠, 🚀, 💡, 😎, 🎯, 🔥), break down complex concepts into simple bite-sized explanations, use helpful memory tricks or practice questions, and encourage the user with positive, relaxed energy!",
    default: "You are HeatGPT, an ultra-intelligent, super chill, friendly, and helpful AI assistant! Use a relaxed, engaging tone and plenty of fun expressive emojis (😎, ✨, 🔥, 🚀) to make chatting enjoyable!",
    coder: "You are HeatGPT Software Specialist 💻 — an expert Senior Software Engineer.",
    writer: "You are HeatGPT Creative Writer ✍️ — a master copywriter and creative content strategist.",
    concise: "You are HeatGPT Analyst ⚡ — direct, concise, bulleted, and no-fluff answers!"
};

// ==========================================================================
// UTILITY FUNCTIONS & MARKDOWN PARSER
// ==========================================================================
window.escapeHtml = function(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

window.parseMarkdown = function(rawText) {
    if (!rawText) return '';
    let parsed = rawText;

    // Callout Transformers (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING])
    parsed = parsed.replace(/^>\s*\[!NOTE\]\s*(.*)$/gmi, '<div class="callout callout-note"><i class="fa-solid fa-circle-info"></i> <div>$1</div></div>');
    parsed = parsed.replace(/^>\s*\[!TIP\]\s*(.*)$/gmi, '<div class="callout callout-tip"><i class="fa-solid fa-lightbulb"></i> <div>$1</div></div>');
    parsed = parsed.replace(/^>\s*\[!IMPORTANT\]\s*(.*)$/gmi, '<div class="callout callout-important"><i class="fa-solid fa-triangle-exclamation"></i> <div>$1</div></div>');
    parsed = parsed.replace(/^>\s*\[!WARNING\]\s*(.*)$/gmi, '<div class="callout callout-warning"><i class="fa-solid fa-fire"></i> <div>$1</div></div>');

    if (typeof marked !== 'undefined') {
        try {
            parsed = marked.parse(parsed);
        } catch (e) {
            console.error("Marked parse error:", e);
        }
    }
    return parsed;
};

// ==========================================================================
// SESSION MANAGEMENT & CHAT STORE
// ==========================================================================
window.getSessions = function() {
    return JSON.parse(localStorage.getItem('heatgpt_sessions_v1') || '[]');
};

window.saveSessions = function(sessions) {
    localStorage.setItem('heatgpt_sessions_v1', JSON.stringify(sessions));
};

window.createNewSession = function() {
    const sessions = window.getSessions();
    const newSession = {
        id: 'session_' + Date.now(),
        title: 'New Chat',
        created_at: new Date().toISOString(),
        messages: []
    };
    sessions.unshift(newSession);
    window.saveSessions(sessions);
    window.activeSessionId = newSession.id;
    window.renderHistoryList();
    window.renderActiveSession();
};

window.switchSession = function(sessionId) {
    window.activeSessionId = sessionId;
    window.renderHistoryList();
    window.renderActiveSession();
};

window.deleteSession = function(sessionId, event) {
    if (event) event.stopPropagation();
    let sessions = window.getSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    window.saveSessions(sessions);

    if (window.activeSessionId === sessionId) {
        if (sessions.length > 0) {
            window.activeSessionId = sessions[0].id;
        } else {
            window.createNewSession();
            return;
        }
    }
    window.renderHistoryList();
    window.renderActiveSession();
};

window.clearCurrentChat = function() {
    if (!window.activeSessionId) return;
    let sessions = window.getSessions();
    const session = sessions.find(s => s.id === window.activeSessionId);
    if (session) {
        session.messages = [];
        window.saveSessions(sessions);
        window.renderActiveSession();
    }
};

window.renderHistoryList = function() {
    const listEl = document.getElementById('chatHistoryList');
    if (!listEl) return;
    const sessions = window.getSessions();
    listEl.innerHTML = '';

    sessions.forEach(s => {
        const item = document.createElement('div');
        item.className = `history-item ${s.id === window.activeSessionId ? 'active' : ''}`;
        item.onclick = () => window.switchSession(s.id);

        item.innerHTML = `
            <i class="fa-regular fa-message"></i>
            <span class="history-item-title">${escapeHtml(s.title || 'Chat')}</span>
            <button type="button" class="history-delete-btn" onclick="deleteSession('${s.id}', event)" title="Delete session">&times;</button>
        `;
        listEl.appendChild(item);
    });
};

window.renderActiveSession = function() {
    const feed = document.getElementById('chatFeed');
    const welcome = document.getElementById('welcomeContainer');
    if (!feed) return;

    const sessions = window.getSessions();
    const session = sessions.find(s => s.id === window.activeSessionId);
    const messages = session ? session.messages : [];

    feed.innerHTML = '';

    if (!messages || messages.length === 0) {
        if (welcome) welcome.style.display = 'flex';
        feed.style.display = 'none';
        return;
    }

    if (welcome) welcome.style.display = 'none';
    feed.style.display = 'flex';

    messages.forEach(msg => {
        window.appendMessageBubble(msg.role, msg.content, msg.attachments, false);
    });

    const viewport = document.getElementById('chatViewport');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
};

// ==========================================================================
// CHATBOT MESSAGING ENGINE & STREAMING HANDLER
// ==========================================================================
window.appendMessageBubble = function(role, content, attachments = [], isStreaming = false) {
    const feed = document.getElementById('chatFeed');
    const welcome = document.getElementById('welcomeContainer');
    if (!feed) return null;

    if (welcome) welcome.style.display = 'none';
    feed.style.display = 'flex';

    const msgDiv = document.createElement('div');
    msgDiv.className = `message-row ${role === 'user' ? 'user-row' : 'bot-row'}`;

    let attachmentsHtml = '';
    if (attachments && attachments.length > 0) {
        attachmentsHtml += '<div class="msg-attachments-container">';
        attachments.forEach(att => {
            if (att.type === 'image') {
                attachmentsHtml += `<img src="${att.data}" class="msg-attached-img" alt="Uploaded Image">`;
            } else {
                attachmentsHtml += `<div class="msg-attached-file"><i class="fa-solid fa-file-code"></i> ${escapeHtml(att.name)}</div>`;
            }
        });
        attachmentsHtml += '</div>';
    }

    const isBot = role !== 'user';

    msgDiv.innerHTML = `
        <div class="message-avatar ${isBot ? 'bot-avatar' : 'user-avatar-small'}">
            ${isBot ? '<i class="fa-solid fa-fire-flame-curved"></i>' : 'H'}
        </div>
        <div class="message-bubble-card">
            ${attachmentsHtml}
            <div class="message-text-content">${isBot ? window.parseMarkdown(content) : escapeHtml(content)}</div>
            ${isBot ? `
                <div class="message-action-toolbar">
                    <button type="button" class="msg-action-btn" onclick="speakText(this.closest('.message-bubble-card').querySelector('.message-text-content').innerText, this.querySelector('i'))" title="Read Aloud Voice">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                    <button type="button" class="msg-action-btn" onclick="navigator.clipboard.writeText(this.closest('.message-bubble-card').querySelector('.message-text-content').innerText)" title="Copy Message">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    feed.appendChild(msgDiv);
    
    // Highlight Code Syntax
    if (typeof hljs !== 'undefined') {
        msgDiv.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
    
    // Render KaTeX Math
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(msgDiv, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ]
            });
        } catch (e) {}
    }

    const viewport = document.getElementById('chatViewport');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;

    return msgDiv;
};

window.sendMessage = async function() {
    if (window.isGenerating) return;

    const input = document.getElementById('chatInput');
    const text = input ? input.value.trim() : '';

    if (!text && window.pendingAttachments.length === 0) return;

    const currentAttachments = [...window.pendingAttachments];
    window.pendingAttachments = [];
    window.renderAttachmentPreviews();

    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }

    let sessions = window.getSessions();
    let session = sessions.find(s => s.id === window.activeSessionId);
    if (!session) {
        window.createNewSession();
        sessions = window.getSessions();
        session = sessions.find(s => s.id === window.activeSessionId);
    }

    // Set title on first message
    if (session.messages.length === 0) {
        session.title = text ? (text.length > 25 ? text.substring(0, 25) + '...' : text) : 'Attachment Chat';
        window.renderHistoryList();
    }

    const userMsg = { role: 'user', content: text, attachments: currentAttachments };
    session.messages.push(userMsg);
    window.saveSessions(sessions);

    window.appendMessageBubble('user', text, currentAttachments, false);

    // Prepare Bot Stream Bubble
    const botMsgDiv = window.appendMessageBubble('model', '', [], true);
    const contentEl = botMsgDiv ? botMsgDiv.querySelector('.message-text-content') : null;
    const isMedia = text.toLowerCase().includes('photo') || text.toLowerCase().includes('image') || text.toLowerCase().includes('video') || text.toLowerCase().includes('draw') || text.toLowerCase().includes('picture') || text.toLowerCase().includes('paint');
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="ai-generating-loader">
                <div class="ai-spinner-ring"></div>
                <div class="ai-generating-text">
                    <span>${isMedia ? 'Gemini AI is generating your FLUX 8K visual...' : 'Gemini AI is analyzing & generating response...'}</span>
                    <small>${isMedia ? 'Synthesizing 8K ray tracing, camera composition & rendering HD media ✨' : 'Reasoning with Gemini CoT & formatting response ✨'}</small>
                </div>
            </div>
        `;
    }

    window.isGenerating = true;
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = true;

    const modelSelect = document.getElementById('modelSelect');
    const personaSelect = document.getElementById('personaSelect');
    const customPrompt = localStorage.getItem('custom_system_prompt_v1') || '';
    const personaKey = personaSelect ? personaSelect.value : 'default';
    const personaText = window.PERSONAS[personaKey] || window.PERSONAS.default;
    const systemPrompt = customPrompt ? `${personaText}\n\nCustom User Instruction: ${customPrompt}` : personaText;
    const apiKey = localStorage.getItem('gemini_api_key_v1') || '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: session.messages,
                mode: window.activeMode,
                research_mode: window.isResearchMode,
                model: modelSelect ? modelSelect.value : 'gemini-3.5-flash',
                persona: personaKey,
                system_prompt: systemPrompt,
                api_key: apiKey,
                tasks: window.getTasks()
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullBotResponse = '';

        if (contentEl) contentEl.innerHTML = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (let line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.replace('data: ', '').trim();
                    if (!jsonStr) continue;
                    try {
                        const parsedData = JSON.parse(jsonStr);
                        if (parsedData.text) {
                            fullBotResponse += parsedData.text;
                            if (contentEl) {
                                contentEl.innerHTML = window.parseMarkdown(fullBotResponse);
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        // Save complete response
        session.messages.push({ role: 'model', content: fullBotResponse });
        window.saveSessions(sessions);

        // Natural Voice Read Aloud if Voice Mode is ON
        if (window.isVoiceChatMode && fullBotResponse) {
            window.speakText(fullBotResponse);
        }

    } catch (err) {
        console.error("Chat streaming error:", err);
        if (contentEl) {
            contentEl.innerHTML = `⚠️ **Error connecting to HeatGPT**: ${err.message}`;
        }
    } finally {
        window.isGenerating = false;
        if (sendBtn) sendBtn.disabled = false;
    }
};

// ==========================================================================
// ⏱️ FOCUS MODE & POMODORO TIMER ENGINE
// ==========================================================================
window.openFocusModal = function() {
    const modal = document.getElementById('focusConfigModal');
    if (modal) modal.classList.add('active');
};

window.closeFocusModal = function() {
    const modal = document.getElementById('focusConfigModal');
    if (modal) modal.classList.remove('active');
};

window.toggleCustomFocusMinutes = function() {
    const select = document.getElementById('focusPresetSelect');
    const group = document.getElementById('customFocusGroup');
    if (select && group) {
        group.style.display = select.value === 'custom' ? 'block' : 'none';
    }
};

const FOCUS_AI_QUOTES = [
    "\"Stay locked into your job. Small consistent efforts lead to massive success! 🧠🔥\"",
    "\"Deep concentration is your superpower. Eliminate all distractions and build momentum! 🚀✨\"",
    "\"Focus on one task at a time. Quality over quantity always wins! 💡🎯\"",
    "\"You're in the flow zone now! Every minute spent studying is an investment in your future. 📚⚡\"",
    "\"Keep pushing! Break through resistance and conquer your target job. 😎🏆\""
];

window.startFocusSession = function() {
    const jobInp = document.getElementById('focusJobGoal');
    const presetSelect = document.getElementById('focusPresetSelect');
    const customInp = document.getElementById('customFocusMinutes');
    const soundSelect = document.getElementById('focusSoundSelect');

    let minutes = 25;
    if (presetSelect) {
        if (presetSelect.value === 'custom') {
            minutes = parseInt(customInp ? customInp.value : 30) || 30;
        } else {
            minutes = parseInt(presetSelect.value) || 25;
        }
    }

    window.focusJobTitle = (jobInp && jobInp.value.trim()) ? jobInp.value.trim() : "Deep Work Focus";
    window.focusTotalSeconds = minutes * 60;
    window.focusRemainingSeconds = window.focusTotalSeconds;
    window.isFocusRunning = true;

    window.closeFocusModal();

    const overlay = document.getElementById('focusOverlay');
    const badgeText = document.getElementById('focusJobBadgeText');
    const quoteText = document.getElementById('focusAiQuoteText');

    if (overlay) overlay.classList.add('active');
    if (badgeText) badgeText.innerText = `Job: ${window.focusJobTitle}`;
    if (quoteText) quoteText.innerText = FOCUS_AI_QUOTES[Math.floor(Math.random() * FOCUS_AI_QUOTES.length)];

    window.startFocusAmbientSound(soundSelect ? soundSelect.value : 'white');

    if (window.focusTimerInterval) clearInterval(window.focusTimerInterval);
    window.updateFocusTimerUI();

    window.focusTimerInterval = setInterval(() => {
        if (window.isFocusRunning) {
            window.focusRemainingSeconds--;
            window.updateFocusTimerUI();

            if (window.focusRemainingSeconds <= 0) {
                window.completeFocusSession(true);
            }
        }
    }, 1000);
};

window.updateFocusTimerUI = function() {
    const clockDigits = document.getElementById('focusClockDigits');
    const clockStatus = document.getElementById('focusClockStatus');
    const circleProgress = document.getElementById('focusCircleProgress');

    const mins = Math.floor(window.focusRemainingSeconds / 60);
    const secs = window.focusRemainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (clockDigits) clockDigits.innerText = formatted;
    document.title = `(${formatted}) HeatGPT Focus Mode — ${window.focusJobTitle}`;

    if (clockStatus) {
        clockStatus.innerText = window.isFocusRunning ? "Focusing" : "Paused";
    }

    if (circleProgress) {
        const circumference = 753; // 2 * PI * 120
        const progressFraction = window.focusRemainingSeconds / window.focusTotalSeconds;
        const offset = circumference * (1 - progressFraction);
        circleProgress.style.strokeDashoffset = offset;
    }
};

window.toggleFocusPause = function() {
    window.isFocusRunning = !window.isFocusRunning;
    const btnIcon = document.querySelector('#focusPlayPauseBtn i');

    if (btnIcon) {
        btnIcon.className = window.isFocusRunning ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    window.updateFocusTimerUI();
};

window.resetFocusTimer = function() {
    window.focusRemainingSeconds = window.focusTotalSeconds;
    window.updateFocusTimerUI();
};

window.completeFocusSession = function(autoFinished = false) {
    if (window.focusTimerInterval) clearInterval(window.focusTimerInterval);
    window.isFocusRunning = false;
    window.stopFocusAmbientSound();
    document.title = "HeatGPT - Intelligent AI Assistant & Study Hub";

    const overlay = document.getElementById('focusOverlay');
    if (overlay) overlay.classList.remove('active');

    if (autoFinished) {
        window.playFocusCompletionChime();
        alert(`🎉 Focus Session Completed!\nGreat job staying focused on: "${window.focusJobTitle}"! Take a well-deserved break! 🏆✨`);
    }
};

window.exitFocusSession = function() {
    if (confirm("Are you sure you want to exit Focus Mode?")) {
        window.completeFocusSession(false);
    }
};

// HIGH DEFINITION WEB AUDIO API AMBIENT SOUND SYNTHESIZER
window.startFocusAmbientSound = function(soundType) {
    window.stopFocusAmbientSound();
    if (soundType === 'silent') return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        window.focusAudioCtx = new AudioContext();
        const ctx = window.focusAudioCtx;

        function createNoiseBuffer(seconds = 5) {
            const bufferSize = ctx.sampleRate * seconds;
            const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
            for (let channel = 0; channel < 2; channel++) {
                const data = buffer.getChannelData(channel);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
            }
            return buffer;
        }

        if (soundType === 'white' || soundType === 'white_noise') {
            // 🎧 CRISP PURE WHITE NOISE
            const noise = ctx.createBufferSource();
            noise.buffer = createNoiseBuffer(5);
            noise.loop = true;

            const highpass = ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 150;

            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 5000;

            const gain = ctx.createGain();
            gain.gain.value = 0.06;

            noise.connect(highpass);
            highpass.connect(lowpass);
            lowpass.connect(gain);
            gain.connect(ctx.destination);
            noise.start();

        } else if (soundType === 'rain') {
            // 🌧️ COZY REALISTIC FALLING RAIN
            const noise = ctx.createBufferSource();
            noise.buffer = createNoiseBuffer(5);
            noise.loop = true;

            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 1200;

            const highpass = ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 250;

            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.2;

            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 300;
            lfo.connect(lfoGain);
            lfoGain.connect(lowpass.frequency);

            const gain = ctx.createGain();
            gain.gain.value = 0.08;

            noise.connect(highpass);
            highpass.connect(lowpass);
            lowpass.connect(gain);
            gain.connect(ctx.destination);

            lfo.start();
            noise.start();

        } else if (soundType === 'waves') {
            // 🌊 RHYTHMIC OCEAN SHORE WAVES
            const noise = ctx.createBufferSource();
            noise.buffer = createNoiseBuffer(5);
            noise.loop = true;

            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 300;

            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1;

            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 400;
            lfo.connect(lfoGain);
            lfoGain.connect(lowpass.frequency);

            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.09;

            noise.connect(lowpass);
            lowpass.connect(masterGain);
            masterGain.connect(ctx.destination);

            lfo.start();
            noise.start();

        } else if (soundType === 'lofi') {
            // 🎵 WARM LO-FI AMBIENT CHORDS & VINYL TEXTURE
            const osc1 = ctx.createOscillator();
            osc1.type = 'triangle';
            osc1.frequency.value = 220;

            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = 329.63;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600;

            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.04;

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(masterGain);
            masterGain.connect(ctx.destination);

            osc1.start();
            osc2.start();

            const noise = ctx.createBufferSource();
            noise.buffer = createNoiseBuffer(5);
            noise.loop = true;

            const vinylFilter = ctx.createBiquadFilter();
            vinylFilter.type = 'bandpass';
            vinylFilter.frequency.value = 2000;

            const vinylGain = ctx.createGain();
            vinylGain.gain.value = 0.015;

            noise.connect(vinylFilter);
            vinylFilter.connect(vinylGain);
            vinylGain.connect(ctx.destination);
            noise.start();
        }
    } catch (e) {
        console.log("Web Audio ambient sound error:", e);
    }
};

window.stopFocusAmbientSound = function() {
    if (window.focusAudioCtx) {
        try {
            window.focusAudioCtx.close();
        } catch (e) {}
        window.focusAudioCtx = null;
    }
};

window.playFocusCompletionChime = function() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 Major Chime
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.15);
            gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.15);
            osc.stop(ctx.currentTime + idx * 0.15 + 0.7);
        });
    } catch (e) {}
};

// ==========================================================================
// HIGH-DEFINITION NATURAL HUMAN VOICE SYNTHESIZER
// ==========================================================================
window.getBestNaturalVoice = function(gender = null) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const naturalKeywordsMale = [
        "Google US English", "Microsoft Guy Online (Natural) - English (United States)",
        "Microsoft Guy", "Guy Online", "Alex", "Daniel", "David", "Male"
    ];

    const naturalKeywordsFemale = [
        "Google UK English Female", "Microsoft Jenny Online (Natural) - English (United States)",
        "Microsoft Aria Online (Natural) - English (United States)", "Microsoft Jenny",
        "Jenny Online", "Samantha", "Karen", "Aria", "Female"
    ];

    if (gender === 'male') {
        for (const kw of naturalKeywordsMale) {
            const v = voices.find(voice => (voice.name.includes(kw) || voice.voiceURI.includes(kw)) && voice.lang.startsWith('en'));
            if (v) return v;
        }
    } else if (gender === 'female') {
        for (const kw of naturalKeywordsFemale) {
            const v = voices.find(voice => (voice.name.includes(kw) || voice.voiceURI.includes(kw)) && voice.lang.startsWith('en'));
            if (v) return v;
        }
    }

    if (window.selectedVoiceURI) {
        const found = voices.find(v => v.voiceURI === window.selectedVoiceURI);
        if (found) return found;
    }

    const priorityVoices = [
        "Google US English", "Google UK English Female", "Microsoft Natural", "Jenny Online", "Guy Online", "Samantha", "Alex"
    ];

    for (const kw of priorityVoices) {
        const v = voices.find(voice => voice.name.includes(kw) || voice.voiceURI.includes(kw));
        if (v) return v;
    }

    return voices.find(v => v.lang.startsWith('en')) || voices[0];
};

window.populateVoiceDropdown = function() {
    const select = document.getElementById('voiceSelect');
    if (!select || !('speechSynthesis' in window)) return;
    
    const voices = window.speechSynthesis.getVoices();
    select.innerHTML = '<option value="">Auto-Detect Best Natural Voice (Google / Microsoft Natural)</option>';
    
    voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.innerText = `${v.name} (${v.lang}) ${v.default ? '— Default' : ''}`;
        if (v.voiceURI === window.selectedVoiceURI) opt.selected = true;
        select.appendChild(opt);
    });
};

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.populateVoiceDropdown();
}

window.cleanTextForSpeech = function(rawMarkdown) {
    if (!rawMarkdown) return '';
    let text = rawMarkdown;
    text = text.replace(/```[\s\S]*?```/g, ' Code snippet omitted. ');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/!\[.*?\]\(.*?\)/g, '');
    text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    text = text.replace(/[*_~#>-]/g, ' ');
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    return text.replace(/\s+/g, ' ').trim();
};

window.speakText = function(rawText, btnIconEl = null) {
    if (!('speechSynthesis' in window)) return;
    window.stopSpeech();

    const cleanText = window.cleanTextForSpeech(rawText);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = window.getBestNaturalVoice();
    if (voice) utterance.voice = voice;

    utterance.rate = window.voiceSpeed || 1.02;
    utterance.pitch = window.voicePitch || 1.0;

    if (btnIconEl) btnIconEl.className = 'fa-solid fa-volume-high fa-bounce';

    utterance.onend = () => {
        if (btnIconEl) btnIconEl.className = 'fa-solid fa-volume-high';
        window.currentUtterance = null;
    };

    utterance.onerror = () => {
        if (btnIconEl) btnIconEl.className = 'fa-solid fa-volume-high';
        window.currentUtterance = null;
    };

    window.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
};

window.stopSpeech = function() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    window.currentUtterance = null;
    window.podcastUtterance = null;
    window.isPodcastPlaying = false;
    window.updatePodcastPlayBtnState();
};

window.toggleVoiceChatMode = function() {
    window.isVoiceChatMode = !window.isVoiceChatMode;
    console.log("[HeatGPT] Voice Chat Mode set to:", window.isVoiceChatMode);

    const btn = document.getElementById('voiceChatModeBtn');
    const label = document.getElementById('voiceChatBtnLabel');
    const icon = document.getElementById('voiceChatBtnIcon');

    if (window.isVoiceChatMode) {
        if (btn) btn.className = 'voice-chat-toggle-btn active';
        if (label) label.innerHTML = 'Voice Chat: <strong>ON 🔊</strong>';
        if (icon) icon.className = 'fa-solid fa-volume-high fa-bounce';
    } else {
        window.stopSpeech();
        if (btn) btn.className = 'voice-chat-toggle-btn';
        if (label) label.innerHTML = 'Voice Chat: <strong>OFF</strong>';
        if (icon) icon.className = 'fa-solid fa-volume-high';
    }
};

// ==========================================================================
// 🎙️ HIGH QUALITY DUAL-VOICE AI PODCAST ENGINE & REAL MP3 AUDIO DOWNLOAD
// ==========================================================================
window.openPodcastModal = function() {
    const modal = document.getElementById('podcastConfigModal');
    if (modal) modal.classList.add('active');
};

window.closePodcastModal = function() {
    const modal = document.getElementById('podcastConfigModal');
    if (modal) modal.classList.remove('active');
};

window.closePodcastPlayerModal = function() {
    window.stopSpeech();
    const modal = document.getElementById('podcastPlayerModal');
    if (modal) modal.classList.remove('active');
};

window.useInstantPodcastFallback = function() {
    const topicEl = document.getElementById('podcastTopic');
    const topic = (topicEl && topicEl.value) ? topicEl.value.trim() : 'Artificial Intelligence';

    window.currentPodcast = {
        title: `HeatGPT Deep Dive: ${topic}`,
        description: `Join Alex & Taylor as they unpack ${topic} in an engaging deep dive session!`,
        hosts: ["Alex", "Taylor"],
        transcript: [
            { speaker: "Alex", voice_gender: "male", text: `Yo, welcome back to HeatGPT Deep Dives! Today we are exploring ${topic}.` },
            { speaker: "Taylor", voice_gender: "female", text: `Hey everyone! I am super excited to dive into ${topic} today.` },
            { speaker: "Alex", voice_gender: "male", text: `What makes ${topic} so fascinating is how it applies to real-world learning and problem solving.` },
            { speaker: "Taylor", voice_gender: "female", text: `Right! Once you see the foundational principles, everything falls into place effortlessly.` },
            { speaker: "Alex", voice_gender: "male", text: `Exactly! Let's break down the key takeaways so everyone gets the big picture.` },
            { speaker: "Taylor", voice_gender: "female", text: `Awesome Alex! Thanks for tuning in everyone!` }
        ]
    };
    window.currentPodcastTurnIndex = 0;

    const loading = document.getElementById('podcastLoadingState');
    const body = document.getElementById('podcastPlayerBody');

    if (loading) loading.style.display = 'none';
    if (body) body.style.display = 'flex';

    window.renderPodcastTeleprompter(window.currentPodcast);
    try {
        window.playPodcastTurn(0);
    } catch (e) {
        console.log("Autoplay paused:", e);
    }
};

window.generatePodcastEpisode = async function() {
    const topicEl = document.getElementById('podcastTopic');
    const topic = (topicEl && topicEl.value) ? topicEl.value.trim() : 'The Future of Artificial Intelligence';
    
    const formatEl = document.getElementById('podcastFormat');
    const format = formatEl ? formatEl.value : 'dual_host';

    const lengthEl = document.getElementById('podcastLength');
    const length = lengthEl ? lengthEl.value : 'standard';

    const toneEl = document.getElementById('podcastTone');
    const tone = toneEl ? toneEl.value : 'chill';

    const modelSelect = document.getElementById('modelSelect');
    const apiKey = localStorage.getItem('gemini_api_key_v1') || '';

    window.closePodcastModal();
    const modal = document.getElementById('podcastPlayerModal');
    const loading = document.getElementById('podcastLoadingState');
    const body = document.getElementById('podcastPlayerBody');
    const title = document.getElementById('podcastPlayerTitle');
    const subtitle = document.getElementById('podcastPlayerSubtitle');
    const titleStatus = document.getElementById('podcastLoadingStatusTitle');
    const subStatus = document.getElementById('podcastLoadingSubText');

    if (modal) modal.classList.add('active');
    if (loading) loading.style.display = 'flex';
    if (body) body.style.display = 'none';

    if (titleStatus) titleStatus.innerText = "Gemini AI is Writing Episode Script...";
    if (subStatus) subStatus.innerText = `Topic: "${topic}" • Setting up dual-host dialogue...`;

    if (title) title.innerHTML = `<i class="fa-solid fa-podcast" style="color: #10b981;"></i> ${escapeHtml(topic)}`;
    if (subtitle) subtitle.innerText = `Gemini AI Podcast Episode | Format: ${format}`;

    // Safety fallback timer if API takes > 7 seconds
    const fallbackTimer = setTimeout(() => {
        if (loading && loading.style.display !== 'none' && (!body || body.style.display === 'none')) {
            console.log("Switching to instant fast podcast script fallback!");
            window.useInstantPodcastFallback();
        }
    }, 7500);

    try {
        const res = await fetch('/api/podcast_generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                topic, 
                format, 
                length, 
                tone, 
                model: modelSelect ? modelSelect.value : 'gemini-3.5-flash', 
                api_key: apiKey 
            })
        });

        clearTimeout(fallbackTimer);

        if (!res.ok) {
            window.useInstantPodcastFallback();
            return;
        }

        const json = await res.json();
        if (!json.podcast || !json.podcast.transcript || json.podcast.transcript.length === 0) {
            window.useInstantPodcastFallback();
            return;
        }

        window.currentPodcast = json.podcast;
        window.currentPodcastTurnIndex = 0;

        if (loading) loading.style.display = 'none';
        if (body) body.style.display = 'flex';

        window.renderPodcastTeleprompter(window.currentPodcast);
        
        try {
            window.playPodcastTurn(0);
        } catch (playErr) {
            console.log("Autoplay paused by browser:", playErr);
        }

    } catch (e) {
        clearTimeout(fallbackTimer);
        console.log("Podcast fetch exception:", e);
        window.useInstantPodcastFallback();
    }
};

window.renderPodcastTeleprompter = function(podcast) {
    const feed = document.getElementById('podcastTranscriptFeed');
    const descText = document.getElementById('podcastDescText');

    if (descText) descText.innerText = podcast.description || 'Welcome to HeatGPT AI Podcast Deep Dive!';
    if (!feed) return;

    feed.innerHTML = '';
    const transcript = podcast.transcript || [];

    transcript.forEach((turn, idx) => {
        const card = document.createElement('div');
        card.className = `podcast-turn-card ${idx === 0 ? 'active-speaker' : ''}`;
        card.id = `podcast_turn_${idx}`;
        card.onclick = () => window.playPodcastTurn(idx);

        card.innerHTML = `
            <div class="turn-speaker-header ${turn.speaker}">
                <span>${turn.speaker === 'Alex' ? '🎙️ Alex (Host)' : (turn.speaker === 'Taylor' ? '🎧 Taylor (Co-Host)' : '📢 Host')}</span>
                <small style="color: #64748b; font-weight: 500;">Turn #${idx + 1}</small>
            </div>
            <div class="turn-speech-text">${escapeHtml(turn.text)}</div>
        `;
        feed.appendChild(card);
    });
};

window.playPodcastTurn = function(index) {
    if (!window.currentPodcast || !window.currentPodcast.transcript) return;
    const transcript = window.currentPodcast.transcript;

    if (index < 0 || index >= transcript.length) {
        window.stopSpeech();
        window.isPodcastPlaying = false;
        window.updatePodcastPlayBtnState();
        return;
    }

    window.currentPodcastTurnIndex = index;
    window.isPodcastPlaying = true;
    window.updatePodcastPlayBtnState();

    document.querySelectorAll('.podcast-turn-card').forEach((card, idx) => {
        card.classList.toggle('active-speaker', idx === index);
    });

    const activeCard = document.getElementById(`podcast_turn_${index}`);
    if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const turn = transcript[index];
    const cleanSpeech = window.cleanTextForSpeech(turn.text);

    if (!('speechSynthesis' in window)) return;
    window.stopSpeech();
    window.isPodcastPlaying = true;
    window.updatePodcastPlayBtnState();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    const gender = turn.voice_gender || (turn.speaker === 'Taylor' ? 'female' : 'male');
    const voice = window.getBestNaturalVoice(gender);
    if (voice) utterance.voice = voice;

    utterance.rate = window.podcastSpeed || 1.0;
    utterance.pitch = gender === 'female' ? 1.08 : 0.96;

    utterance.onend = () => {
        if (window.isPodcastPlaying && window.currentPodcastTurnIndex === index) {
            window.playPodcastTurn(index + 1);
        }
    };

    utterance.onerror = () => {
        if (window.isPodcastPlaying && window.currentPodcastTurnIndex === index) {
            window.playPodcastTurn(index + 1);
        }
    };

    window.podcastUtterance = utterance;
    window.speechSynthesis.speak(utterance);
};

window.togglePodcastPlayback = function() {
    if (window.isPodcastPlaying) {
        window.stopSpeech();
    } else {
        window.playPodcastTurn(window.currentPodcastTurnIndex || 0);
    }
};

window.updatePodcastPlayBtnState = function() {
    const playBtnIcon = document.querySelector('#podcastPlayPauseBtn i');
    const waveBars = document.getElementById('podcastWaveBars');

    if (playBtnIcon) {
        playBtnIcon.className = window.isPodcastPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    if (waveBars) {
        waveBars.classList.toggle('paused', !window.isPodcastPlaying);
    }
};

window.podcastPrevLine = function() {
    if (window.currentPodcastTurnIndex > 0) {
        window.playPodcastTurn(window.currentPodcastTurnIndex - 1);
    }
};

window.podcastNextLine = function() {
    if (window.currentPodcast && window.currentPodcast.transcript && window.currentPodcastTurnIndex < window.currentPodcast.transcript.length - 1) {
        window.playPodcastTurn(window.currentPodcastTurnIndex + 1);
    }
};

window.cyclePodcastSpeed = function() {
    const speeds = [1.0, 1.25, 1.5];
    const currIdx = speeds.indexOf(window.podcastSpeed);
    const nextIdx = (currIdx + 1) % speeds.length;
    window.podcastSpeed = speeds[nextIdx];

    const btn = document.getElementById('podcastSpeedBtn');
    if (btn) btn.innerText = `${window.podcastSpeed}x`;

    if (window.isPodcastPlaying) {
        window.playPodcastTurn(window.currentPodcastTurnIndex);
    }
};

// DOWNLOAD PODCAST SCRIPT TRANSCRIPT (.MD)
window.downloadPodcastTranscript = function() {
    if (!window.currentPodcast) return;
    const p = window.currentPodcast;
    let content = `# ${p.title || 'HeatGPT AI Podcast Episode'}\n\n${p.description || ''}\n\n---\n\n`;

    (p.transcript || []).forEach(turn => {
        content += `**${turn.speaker}**: ${turn.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(p.title || 'podcast_transcript').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
};

// DOWNLOAD REAL MP3 PODCAST AUDIO FILE FROM BACKEND NEURAL TTS ENGINE
window.downloadPodcastAudio = async function() {
    if (!window.currentPodcast || !window.currentPodcast.transcript) {
        alert("No active podcast available to download!");
        return;
    }

    const downloadBtn = document.getElementById('downloadAudioBtn');
    if (downloadBtn) {
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating MP3 Audio...';
    }

    try {
        const res = await fetch('/api/podcast_download_mp3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: window.currentPodcast.transcript,
                title: window.currentPodcast.title || 'heatgpt_podcast_episode'
            })
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (window.currentPodcast.title || 'heatgpt_podcast_episode').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp3';
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        if (downloadBtn) {
            downloadBtn.innerHTML = '<i class="fa-solid fa-check"></i> MP3 Downloaded!';
            setTimeout(() => {
                downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> <span>Download MP3</span>';
            }, 3000);
        }
    } catch (e) {
        alert('Error generating MP3 file: ' + e.message);
        if (downloadBtn) {
            downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> <span>Download MP3</span>';
        }
    }
};

// ==========================================================================
// UPLOAD IMAGES FOR QUIZ GENERATION HANDLERS
// ==========================================================================
window.handleQuizImageSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        window.quizBase64Image = e.target.result;
        const box = document.getElementById('quizImagePreviewBox');
        const thumb = document.getElementById('quizImageThumb');
        const name = document.getElementById('quizImageName');

        if (thumb) thumb.src = e.target.result;
        if (name) name.innerText = file.name;
        if (box) box.style.display = 'flex';
    };
    reader.readAsDataURL(file);
};

window.clearQuizImage = function() {
    window.quizBase64Image = null;
    const inp = document.getElementById('quizImageInput');
    const box = document.getElementById('quizImagePreviewBox');
    if (inp) inp.value = '';
    if (box) box.style.display = 'none';
};

// GENERATE STANDALONE 3D FLASHCARDS DECK
window.currentDeck = [];
window.currentFcIndex = 0;

window.generateFlashcards = async function() {
    const topicEl = document.getElementById('fcTopic');
    const countEl = document.getElementById('fcCount');
    const diffEl = document.getElementById('fcDifficulty');
    
    const topic = (topicEl && topicEl.value.trim()) ? topicEl.value.trim() : 'General Knowledge';
    const count = countEl ? (parseInt(countEl.value) || 5) : 5;
    const difficulty = diffEl ? diffEl.value : 'Intermediate';
    
    const modelSelect = document.getElementById('modelSelect');
    const apiKey = localStorage.getItem('gemini_api_key_v1') || '';

    window.closeFlashcardsModal();
    const modal = document.getElementById('interactiveFlashcardModal');
    const loading = document.getElementById('fcLoadingState');
    const body = document.getElementById('fcPlayerBody');
    const title = document.getElementById('playerDeckTitle');
    const subtitle = document.getElementById('playerDeckSubtitle');

    if (modal) modal.classList.add('active');
    if (loading) loading.style.display = 'flex';
    if (body) body.style.display = 'none';

    if (title) title.innerHTML = `<i class="fa-solid fa-layer-group" style="color: #f97316;"></i> ${escapeHtml(topic)} Flashcard Deck`;
    if (subtitle) subtitle.innerText = `Gemini AI | Difficulty: ${difficulty} | ${count} Cards`;

    try {
        const res = await fetch('/api/study_generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'flashcards', 
                topic, 
                count, 
                difficulty,
                model: modelSelect ? modelSelect.value : 'gemini-2.5-flash', 
                api_key: apiKey 
            })
        });

        const json = await res.json();
        if (json.status === 'ok' && Array.isArray(json.data) && json.data.length > 0) {
            window.currentDeck = json.data;
        } else {
            window.currentDeck = [
                { id: 1, question: `What is the core principle of ${topic}?`, answer: `${topic} involves fundamental mechanisms and key concepts for structured learning and practical application.`, hint: "Core Definition" },
                { id: 2, question: `Why is ${topic} important?`, answer: `Mastering ${topic} unlocks deep analytical understanding and practical problem solving skills.`, hint: "Key Advantage" },
                { id: 3, question: `How do you apply ${topic} effectively?`, answer: `By practicing active recall, studying real-world examples, and building hands-on mastery step-by-step.`, hint: "Practical Method" }
            ];
        }

        window.currentFcIndex = 0;
        if (loading) loading.style.display = 'none';
        if (body) body.style.display = 'flex';
        window.renderCurrentFlashcard();

    } catch (e) {
        console.error("Error generating flashcards:", e);
        window.currentDeck = [
            { id: 1, question: `What is the core definition of ${topic}?`, answer: `${topic} is a key field of study focusing on foundational rules and practical skills.`, hint: "Core Definition" },
            { id: 2, question: `What are key applications of ${topic}?`, answer: `It is used across academic research, real-world projects, and problem solving.`, hint: "Application" }
        ];
        window.currentFcIndex = 0;
        if (loading) loading.style.display = 'none';
        if (body) body.style.display = 'flex';
        window.renderCurrentFlashcard();
    }
};

// GENERATE STANDALONE QUIZ (WITH MULTIMODAL IMAGE SUPPORT!)
window.generateQuiz = async function() {
    const topicEl = document.getElementById('quizTopic');
    const topic = (topicEl && topicEl.value.trim()) ? topicEl.value.trim() : 'General Knowledge';
    const mcqs = document.getElementById('quizMcq') ? document.getElementById('quizMcq').value : 4;
    const fill_blanks = document.getElementById('quizFill') ? document.getElementById('quizFill').value : 3;
    const short_questions = document.getElementById('quizShort') ? document.getElementById('quizShort').value : 2;
    const long_questions = document.getElementById('quizLong') ? document.getElementById('quizLong').value : 1;
    const difficulty = document.getElementById('quizDifficulty') ? document.getElementById('quizDifficulty').value : 'Intermediate';
    const modelSelect = document.getElementById('modelSelect');
    const apiKey = localStorage.getItem('gemini_api_key_v1') || '';

    window.closeQuizModal();
    const modal = document.getElementById('interactiveQuizModal');
    const loading = document.getElementById('quizLoadingState');
    const body = document.getElementById('quizPlayerBody');
    const reportView = document.getElementById('quizReportView');
    const title = document.getElementById('quizTitleDisplay');
    const subtitle = document.getElementById('quizSubtitleDisplay');

    if (modal) modal.classList.add('active');
    if (loading) loading.style.display = 'flex';
    if (body) body.style.display = 'none';
    if (reportView) reportView.style.display = 'none';

    if (title) title.innerHTML = `<i class="fa-solid fa-clipboard-question" style="color: #ef4444;"></i> ${escapeHtml(topic)} Test Paper`;
    if (subtitle) subtitle.innerText = `Gemini AI | Difficulty: ${difficulty} | ${window.quizBase64Image ? '🖼️ Source Image Attached' : 'Topic Based'}`;

    try {
        const res = await fetch('/api/study_generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'quiz', 
                topic, 
                mcqs, 
                fill_blanks, 
                short_questions, 
                long_questions, 
                difficulty,
                image_data: window.quizBase64Image || '',
                model: modelSelect ? modelSelect.value : 'gemini-2.5-flash', 
                api_key: apiKey 
            })
        });
        const json = await res.json();
        if (json.status === 'ok' && json.data) {
            window.currentQuizData = json.data;
        } else {
            window.currentQuizData = {
                mcqs: [
                    { id: 1, question: `What is the primary foundation of ${topic}?`, options: ["Core Principle", "Secondary Method", "Unrelated Theory", "None of the above"], correct: "Core Principle", explanation: "Core Principle represents the primary foundation." },
                    { id: 2, question: `Which concept is essential when studying ${topic}?`, options: ["Active Recall", "Passive Reading", "Ignoring Feedback", "Rote Memorization"], correct: "Active Recall", explanation: "Active recall produces the highest long-term retention." }
                ],
                fill_blanks: [
                    { id: 1, question: `${topic} relies heavily on ______ for effective problem solving.`, correct: "practice" }
                ],
                short_questions: [
                    { id: 1, question: `Explain the main goal of ${topic} in 2 sentences.`, sample_answer: `The main goal of ${topic} is to build structured knowledge and solve practical problems effectively.` }
                ],
                long_questions: [
                    { id: 1, question: `Discuss key strategies for mastering ${topic}.`, key_concepts: ["Structured Learning", "Consistent Practice", "Self Evaluation"] }
                ]
            };
        }

        if (loading) loading.style.display = 'none';
        if (body) body.style.display = 'flex';
        renderInteractiveQuizForm(window.currentQuizData);

    } catch (e) {
        console.error("Error generating quiz:", e);
        window.currentQuizData = {
            mcqs: [
                { id: 1, question: `What is the primary foundation of ${topic}?`, options: ["Core Principle", "Secondary Method", "Unrelated Theory", "None of the above"], correct: "Core Principle", explanation: "Core Principle represents the foundation." }
            ],
            fill_blanks: [{ id: 1, question: `${topic} relies on ______.`, correct: "practice" }],
            short_questions: [{ id: 1, question: `What is ${topic}?`, sample_answer: `${topic} is a field of study.` }],
            long_questions: [{ id: 1, question: `Summarize ${topic}.`, key_concepts: ["Basics", "Applications"] }]
        };
        if (loading) loading.style.display = 'none';
        if (body) body.style.display = 'flex';
        renderInteractiveQuizForm(window.currentQuizData);
    }
};

function renderInteractiveQuizForm(quiz) {
    const feed = document.getElementById('quizQuestionsFeed');
    if (!feed) return;
    feed.innerHTML = '';
    let qCount = 0;

    if (quiz.mcqs && quiz.mcqs.length > 0) {
        quiz.mcqs.forEach((q, idx) => {
            qCount++;
            const card = document.createElement('div');
            card.className = 'quiz-q-card';
            card.innerHTML = `
                <div class="quiz-q-title">Q${qCount}. ${escapeHtml(q.question)}</div>
                <div class="quiz-options-list">
                    ${q.options.map((opt, oIdx) => `
                        <label class="quiz-option-label">
                            <input type="radio" name="mcq_${idx}" value="${['A','B','C','D'][oIdx]}">
                            <span>${escapeHtml(opt)}</span>
                        </label>
                    `).join('')}
                </div>
            `;
            feed.appendChild(card);
        });
    }

    if (quiz.fill_blanks && quiz.fill_blanks.length > 0) {
        quiz.fill_blanks.forEach((q, idx) => {
            qCount++;
            const card = document.createElement('div');
            card.className = 'quiz-q-card';
            card.innerHTML = `
                <div class="quiz-q-title">Q${qCount}. [Fill in Blank] ${escapeHtml(q.question)}</div>
                <input type="text" class="form-input quiz-fill-input" data-idx="${idx}" placeholder="Write missing term here...">
            `;
            feed.appendChild(card);
        });
    }

    if (quiz.short_questions && quiz.short_questions.length > 0) {
        quiz.short_questions.forEach((q, idx) => {
            qCount++;
            const card = document.createElement('div');
            card.className = 'quiz-q-card';
            card.innerHTML = `
                <div class="quiz-q-title">Q${qCount}. [Short Answer] ${escapeHtml(q.question)}</div>
                <textarea class="form-input quiz-short-input" data-idx="${idx}" rows="2" placeholder="Write your short answer..."></textarea>
            `;
            feed.appendChild(card);
        });
    }

    if (quiz.long_questions && quiz.long_questions.length > 0) {
        quiz.long_questions.forEach((q, idx) => {
            qCount++;
            const card = document.createElement('div');
            card.className = 'quiz-q-card';
            card.innerHTML = `
                <div class="quiz-q-title">Q${qCount}. [Long Answer] ${escapeHtml(q.question)}</div>
                <textarea class="form-input quiz-long-input" data-idx="${idx}" rows="4" placeholder="Write detailed answer / essay explanation..."></textarea>
            `;
            feed.appendChild(card);
        });
    }
}

window.submitQuizForGrading = async function() {
    const btn = document.getElementById('submitQuizForGradingBtn');
    const feed = document.getElementById('quizQuestionsFeed');
    const modelSelect = document.getElementById('modelSelect');
    const apiKey = localStorage.getItem('gemini_api_key_v1') || '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gemini AI is grading your exam...';
    }

    const mcqAnswers = {};
    if (feed) {
        feed.querySelectorAll('input[type="radio"]:checked').forEach(r => mcqAnswers[r.name] = r.value);
    }

    const fillAnswers = {};
    if (feed) {
        feed.querySelectorAll('.quiz-fill-input').forEach(inp => fillAnswers[inp.getAttribute('data-idx')] = inp.value);
    }

    const shortAnswers = {};
    if (feed) {
        feed.querySelectorAll('.quiz-short-input').forEach(inp => shortAnswers[inp.getAttribute('data-idx')] = inp.value);
    }

    const longAnswers = {};
    if (feed) {
        feed.querySelectorAll('.quiz-long-input').forEach(inp => longAnswers[inp.getAttribute('data-idx')] = inp.value);
    }

    const studentAnswers = { mcqs: mcqAnswers, fill_blanks: fillAnswers, short: shortAnswers, long: longAnswers };

    try {
        const res = await fetch('/api/study_grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'quiz',
                quiz_data: window.currentQuizData,
                answers: studentAnswers,
                model: modelSelect ? modelSelect.value : 'gemini-3.5-flash',
                api_key: apiKey
            })
        });
        const json = await res.json();
        const report = json.report || { total_percentage: 90, letter_grade: 'A Grade 🏆', summary: 'Awesome performance!' };
        renderQuizGradeReport(report);

    } catch (e) {
        alert('Quiz grading error: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '🎓 Submit Quiz for Gemini AI Grading & Report';
        }
    }
};

function renderQuizGradeReport(report) {
    const body = document.getElementById('quizPlayerBody');
    const reportView = document.getElementById('quizReportView');
    const letter = document.getElementById('reportLetterGrade');
    const percent = document.getElementById('reportScorePercent');
    const summary = document.getElementById('reportSummaryText');
    const detailsFeed = document.getElementById('reportDetailsFeed');

    if (body) body.style.display = 'none';
    if (reportView) reportView.style.display = 'flex';

    if (letter) letter.innerText = report.letter_grade || 'A Grade 🏆';
    if (percent) percent.innerText = `${report.total_percentage || 90}%`;
    if (summary) summary.innerText = report.summary || 'Great work!';

    if (detailsFeed) {
        detailsFeed.innerHTML = '';
        if (report.details && report.details.length > 0) {
            report.details.forEach(d => {
                const item = document.createElement('div');
                item.className = 'quiz-q-card';
                item.innerHTML = `
                    <div style="font-weight: 700; color: ${d.status === 'correct' ? '#10b981' : '#ef4444'};">
                        ${d.status === 'correct' ? '✅ Correct' : '❌ Needs Improvement'}
                    </div>
                    <div>${escapeHtml(d.feedback)}</div>
                `;
                detailsFeed.appendChild(item);
            });
        }
    }
}

// ==========================================================================
// FILE & IMAGE SHARING / ATTACHMENT HANDLERS FOR CHATBOT
// ==========================================================================
window.triggerFileSelect = function() {
    const fileInp = document.getElementById('fileInput');
    if (fileInp) fileInp.click();
};

window.handleFileSelect = function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    window.processFiles(files);
    event.target.value = '';
};

window.processFiles = function(files) {
    Array.from(files).forEach(file => {
        const isImage = file.type.startsWith('image/');
        const reader = new FileReader();

        if (isImage) {
            reader.onload = (e) => {
                window.pendingAttachments.push({
                    type: 'image',
                    name: file.name,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    mime_type: file.type || 'image/png',
                    data: e.target.result
                });
                window.renderAttachmentPreviews();
            };
            reader.readAsDataURL(file);
        } else {
            reader.onload = (e) => {
                window.pendingAttachments.push({
                    type: 'file',
                    name: file.name,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    mime_type: file.type || 'text/plain',
                    text_content: e.target.result
                });
                window.renderAttachmentPreviews();
            };
            reader.readAsText(file);
        }
    });
};

window.removeAttachment = function(index) {
    window.pendingAttachments.splice(index, 1);
    window.renderAttachmentPreviews();
};

window.renderAttachmentPreviews = function() {
    const container = document.getElementById('attachmentPreviewContainer');
    if (!container) return;

    if (!window.pendingAttachments || window.pendingAttachments.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = '';

    window.pendingAttachments.forEach((att, idx) => {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';
        
        if (att.type === 'image') {
            chip.innerHTML = `
                <img src="${att.data}" class="attachment-chip-img" alt="Thumbnail">
                <span class="attachment-chip-name">${escapeHtml(att.name)}</span>
                <button type="button" class="attachment-chip-remove" onclick="removeAttachment(${idx})">&times;</button>
            `;
        } else {
            chip.innerHTML = `
                <i class="fa-solid fa-file-code" style="color: #38bdf8; font-size: 1.1rem;"></i>
                <span class="attachment-chip-name">${escapeHtml(att.name)}</span>
                <button type="button" class="attachment-chip-remove" onclick="removeAttachment(${idx})">&times;</button>
            `;
        }
        container.appendChild(chip);
    });
};

// Clipboard Image Paste Handler
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const filesToProcess = [];
    for (let item of items) {
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            if (blob) filesToProcess.push(blob);
        }
    }
    if (filesToProcess.length > 0) {
        window.processFiles(filesToProcess);
    }
});

// GLOBAL BUTTON HANDLERS
window.toggleSidebar = function() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('closed');
};

window.toggleResearchMode = function() {
    window.isResearchMode = !window.isResearchMode;
    console.log("[HeatGPT] Research Mode set to:", window.isResearchMode);

    const btn = document.getElementById('researchModeBtn');
    const label = document.getElementById('researchBtnLabel');
    const icon = document.getElementById('researchBtnIcon');
    const banner = document.getElementById('researchActiveBanner');
    const container = document.getElementById('inputContainerBox');
    const input = document.getElementById('chatInput');
    const disclaimer = document.getElementById('inputDisclaimerText');

    if (window.isResearchMode) {
        if (btn) {
            btn.className = 'research-toggle-btn active';
            btn.style.background = 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#f97316';
            btn.style.boxShadow = '0 0 25px rgba(249, 115, 22, 0.75)';
        }
        if (container) {
            container.style.borderColor = '#f97316';
            container.style.boxShadow = '0 10px 35px rgba(249, 115, 22, 0.35)';
        }
        if (banner) banner.style.display = 'flex';
        if (label) label.innerHTML = 'Research Mode: <strong>ON</strong> 🟢';
        if (icon) icon.className = 'fa-solid fa-globe fa-spin';
        if (input) input.placeholder = '🌐 Research Mode ACTIVE: Type query to search live web or paste a URL...';
        if (disclaimer) disclaimer.innerHTML = '🌐 <strong style="color:#f97316;">Research Mode Active</strong> — Searching live web & fetching URLs!';
    } else {
        if (btn) {
            btn.className = 'research-toggle-btn';
            btn.style.background = 'rgba(249, 115, 22, 0.12)';
            btn.style.color = '#f97316';
            btn.style.borderColor = 'rgba(249, 115, 22, 0.4)';
            btn.style.boxShadow = 'none';
        }
        if (container) {
            container.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            container.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.4)';
        }
        if (banner) banner.style.display = 'none';
        if (label) label.innerHTML = 'Research Mode: <strong>OFF</strong>';
        if (icon) icon.className = 'fa-solid fa-globe';
        if (input) input.placeholder = 'Ask HeatGPT anything...';
        if (disclaimer) disclaimer.innerText = 'HeatGPT powered by Gemini AI. Focus Mode Timer, White Noise Ambient & Image Uploads enabled!';
    }
};

window.openFlashcardsModal = function() {
    const modal = document.getElementById('flashcardsConfigModal');
    if (modal) modal.classList.add('active');
};

window.closeFlashcardsModal = function() {
    const modal = document.getElementById('flashcardsConfigModal');
    if (modal) modal.classList.remove('active');
};

window.openQuizModal = function() {
    const modal = document.getElementById('quizConfigModal');
    if (modal) modal.classList.add('active');
};

window.closeQuizModal = function() {
    const modal = document.getElementById('quizConfigModal');
    if (modal) modal.classList.remove('active');
};

window.closeFcPlayerModal = function() {
    const modal = document.getElementById('interactiveFlashcardModal');
    if (modal) modal.classList.remove('active');
};

window.closeQuizPlayerModal = function() {
    const modal = document.getElementById('interactiveQuizModal');
    if (modal) modal.classList.remove('active');
};

window.openSettingsModal = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        window.populateVoiceDropdown();
        modal.classList.add('active');
    }
};

window.closeSettingsModal = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('active');
};

window.saveSettings = function() {
    const apiInp = document.getElementById('apiKeyInput');
    const sysInp = document.getElementById('customSystemPromptInput');
    const voiceSelect = document.getElementById('voiceSelect');
    const voiceSpeed = document.getElementById('voiceSpeed');
    const voicePitch = document.getElementById('voicePitch');

    if (apiInp) localStorage.setItem('gemini_api_key_v1', apiInp.value.trim());
    if (sysInp) localStorage.setItem('custom_system_prompt_v1', sysInp.value.trim());
    
    if (voiceSelect) {
        window.selectedVoiceURI = voiceSelect.value;
        localStorage.setItem('heatgpt_voice_uri', voiceSelect.value);
    }
    if (voiceSpeed) {
        window.voiceSpeed = parseFloat(voiceSpeed.value);
        localStorage.setItem('heatgpt_voice_speed', voiceSpeed.value);
    }
    if (voicePitch) {
        window.voicePitch = parseFloat(voicePitch.value);
        localStorage.setItem('heatgpt_voice_pitch', voicePitch.value);
    }

    window.closeSettingsModal();
};

window.setMode = function(mode) {
    window.activeMode = mode;
    const modeGen = document.getElementById('modeGeneralBtn');
    const modeRag = document.getElementById('modeRagBtn');
    const badge = document.getElementById('activeModelBadge');

    if (modeGen) modeGen.classList.toggle('active', mode === 'general');
    if (modeRag) modeRag.classList.toggle('active', mode === 'rag');

    if (badge) {
        if (mode === 'rag') {
            badge.innerHTML = `<i class="fa-solid fa-database" style="color: #38bdf8;"></i> <span>Local Knowledge RAG</span>`;
        } else {
            const select = document.getElementById('modelSelect');
            const val = select ? select.value : 'nano-banana-1.0';
            if (val === 'nano-banana-1.0') {
                badge.innerHTML = `<span style="font-size: 1.1rem;">🍌</span> <span style="color: #facc15; font-weight: 800;">Nano Banana 1.0 (Ultra-Fast)</span>`;
            } else {
                const selectedText = select ? select.options[select.selectedIndex].text : '3.5 Flash';
                const label = selectedText.includes('3.6') ? '3.6 Flash' : (selectedText.includes('3.7') ? '3.7 Flash' : (selectedText.includes('3.1') ? '3.1 Pro' : '3.5 Flash'));
                badge.innerHTML = `<i class="fa-solid fa-fire-flame-curved" style="color: #f97316;"></i> <span>HeatGPT ${label}</span>`;
            }
        }
    }
};

window.sendSuggestion = function(el) {
    const prompt = el.getAttribute('data-prompt');
    const input = document.getElementById('chatInput');
    if (prompt && input) {
        input.value = prompt;
        window.sendMessage();
    }
};

window.flipActiveCard = function() {
    const card = document.getElementById('activeFlipCard');
    if (card) card.classList.toggle('flipped');
};

window.prevFlashcard = function() {
    if (window.currentFcIndex > 0) {
        window.currentFcIndex--;
        window.renderCurrentFlashcard();
    }
};

window.nextFlashcard = function() {
    if (window.currentDeck && window.currentFcIndex < window.currentDeck.length - 1) {
        window.currentFcIndex++;
        window.renderCurrentFlashcard();
    }
};

window.renderCurrentFlashcard = function() {
    if (!window.currentDeck || window.currentDeck.length === 0) return;
    const card = window.currentDeck[window.currentFcIndex];
    const flipCard = document.getElementById('activeFlipCard');
    const hint = document.getElementById('fcCardHint');
    const qText = document.getElementById('fcQuestionText');
    const aText = document.getElementById('fcOfficialAnswerText');
    const counter = document.getElementById('fcProgressCounter');
    const prevBtn = document.getElementById('fcPrevBtn');
    const nextBtn = document.getElementById('fcNextBtn');

    if (flipCard) flipCard.classList.remove('flipped');
    if (hint) hint.innerText = `CARD #${window.currentFcIndex + 1} OF ${window.currentDeck.length} • ${card.hint || 'Question'}`;
    if (qText) qText.innerText = card.question;
    if (aText) aText.innerText = card.answer;
    if (counter) counter.innerText = `${window.currentFcIndex + 1} / ${window.currentDeck.length}`;

    if (prevBtn) prevBtn.disabled = window.currentFcIndex === 0;
    if (nextBtn) nextBtn.disabled = window.currentFcIndex === window.currentDeck.length - 1;
};

// INITIALIZATION ON DOM READY
document.addEventListener('DOMContentLoaded', () => {
    let sessions = JSON.parse(localStorage.getItem('heatgpt_sessions_v1') || '[]');
    if (sessions.length === 0) {
        window.createNewSession();
    } else {
        window.activeSessionId = sessions[0].id;
        window.renderHistoryList();
        window.renderActiveSession();
    }

    const apiKey = localStorage.getItem('gemini_api_key_v1') || '';
    const customPrompt = localStorage.getItem('custom_system_prompt_v1') || '';
    const apiInp = document.getElementById('apiKeyInput');
    const sysInp = document.getElementById('customSystemPromptInput');

    if (apiInp && apiKey) apiInp.value = apiKey;
    if (sysInp && customPrompt) sysInp.value = customPrompt;

    window.populateVoiceDropdown();

    // Auto-resize chat textarea
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
        });
    }
});

// AI PHOTO & VIDEO QUICK PROMPT INSERTERS
window.insertPhotoPrompt = function() {
    const input = document.getElementById('chatInput');
    if (input) {
        input.value = "generate photo of ";
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
};

window.insertVideoPrompt = function() {
    const input = document.getElementById('chatInput');
    if (input) {
        input.value = "generate video of ";
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
};

/* ==========================================================================
   📋 TASK NOTER & MANAGER LOGIC
   ========================================================================== */
window.activeTaskFilter = 'all';

window.getTasks = function() {
    try {
        return JSON.parse(localStorage.getItem('heatgpt_tasks_v1') || '[]');
    } catch (e) {
        return [];
    }
};

window.saveTasks = function(tasks) {
    localStorage.setItem('heatgpt_tasks_v1', JSON.stringify(tasks));
};

window.openTaskModal = function() {
    const modal = document.getElementById('taskNoterModal');
    if (modal) {
        modal.classList.add('active');
        window.renderTasksList();
        const input = document.getElementById('newTaskTitleInput');
        if (input) input.focus();
    }
};

window.closeTaskModal = function() {
    const modal = document.getElementById('taskNoterModal');
    if (modal) modal.classList.remove('active');
};

window.addNewTask = function() {
    const titleInput = document.getElementById('newTaskTitleInput');
    const prioSelect = document.getElementById('newTaskPrioritySelect');
    const title = titleInput ? titleInput.value.trim() : '';
    const priority = prioSelect ? prioSelect.value : 'medium';

    if (!title) return;

    const tasks = window.getTasks();
    const newTask = {
        id: 'task_' + Date.now(),
        title: title,
        priority: priority,
        completed: false,
        created_at: new Date().toISOString()
    };

    tasks.unshift(newTask);
    window.saveTasks(tasks);

    if (titleInput) titleInput.value = '';
    window.renderTasksList();
};

window.toggleTaskCompleted = function(taskId) {
    const tasks = window.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        window.saveTasks(tasks);
        window.renderTasksList();
    }
};

window.deleteTask = function(taskId) {
    let tasks = window.getTasks();
    tasks = tasks.filter(t => t.id !== taskId);
    window.saveTasks(tasks);
    window.renderTasksList();
};

window.clearCompletedTasks = function() {
    let tasks = window.getTasks();
    tasks = tasks.filter(t => !t.completed);
    window.saveTasks(tasks);
    window.renderTasksList();
};

window.setTaskFilter = function(filter) {
    window.activeTaskFilter = filter;
    ['taskFilterAll', 'taskFilterPending', 'taskFilterCompleted'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });

    const activeBtnId = filter === 'pending' ? 'taskFilterPending' : (filter === 'completed' ? 'taskFilterCompleted' : 'taskFilterAll');
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) activeBtn.classList.add('active');

    window.renderTasksList();
};

window.renderTasksList = function() {
    const feed = document.getElementById('taskListFeed');
    const allCount = document.getElementById('taskCountAll');
    const pendingCount = document.getElementById('taskCountPending');
    const completedCount = document.getElementById('taskCountCompleted');
    const pctText = document.getElementById('taskProgressPercentText');
    const pctFill = document.getElementById('taskProgressFillBar');

    if (!feed) return;

    const tasks = window.getTasks();
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    if (allCount) allCount.innerText = tasks.length;
    if (pendingCount) pendingCount.innerText = pendingTasks.length;
    if (completedCount) completedCount.innerText = completedTasks.length;

    // Real-Time Progress Calculation
    const pct = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    if (pctText) pctText.innerText = `${pct}% (${completedTasks.length}/${tasks.length} Done)`;
    if (pctFill) pctFill.style.width = `${pct}%`;

    let filteredTasks = tasks;
    if (window.activeTaskFilter === 'pending') {
        filteredTasks = pendingTasks;
    } else if (window.activeTaskFilter === 'completed') {
        filteredTasks = completedTasks;
    }

    if (filteredTasks.length === 0) {
        feed.innerHTML = `
            <div class="task-empty-state">
                <i class="fa-solid fa-clipboard-check" style="font-size: 2.2rem; color: #facc15; margin-bottom: 8px; display: block;"></i>
                <span>No ${window.activeTaskFilter === 'all' ? '' : window.activeTaskFilter} tasks found. Add a new task above!</span>
            </div>
        `;
        return;
    }

    let html = '';
    filteredTasks.forEach(task => {
        const isDone = task.completed;
        const prioClass = task.priority || 'medium';
        html += `
            <div class="task-item-card ${isDone ? 'completed' : ''}">
                <div class="task-item-left">
                    <button type="button" class="task-toggle-check-btn ${isDone ? 'completed' : ''}" onclick="toggleTaskCompleted('${task.id}')" title="${isDone ? 'Mark as Pending' : 'Mark as Done'}">
                        ${isDone 
                            ? '<i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 1.45rem;"></i>' 
                            : '<i class="fa-regular fa-circle" style="color: #94a3b8; font-size: 1.45rem;"></i>'
                        }
                    </button>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span class="task-title-text ${isDone ? 'completed' : ''}">${escapeHtml(task.title)}</span>
                        <small style="font-size: 0.76rem; color: ${isDone ? '#10b981' : '#94a3b8'}; font-weight: 600;">
                            ${isDone ? '✅ Completed' : '⏳ Pending Task'}
                        </small>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="task-priority-badge ${prioClass}">${prioClass}</span>
                    <button type="button" class="task-delete-btn" onclick="deleteTask('${task.id}')" title="Delete Task">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    });

    feed.innerHTML = html;
};

window.askAiToHelpWithTasks = function() {
    window.closeTaskModal();
    const tasks = window.getTasks();
    if (tasks.length === 0) {
        alert("Please add at least one task first!");
        return;
    }

    const input = document.getElementById('chatInput');
    if (input) {
        input.value = "Please review my current task list. Which tasks have been done and which ones haven't? Give me a prioritized step-by-step action plan to help me finish my pending tasks!";
        window.sendMessage();
    }
};

// Close modal overlay when clicking backdrop outside modal card
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

/* ==========================================================================
   🎓 GOOGLE SCHOOL INTEGRATION (Classroom, Calendar, Gmail & Dashboard)
   ========================================================================== */

window.openSchoolConnectModal = function() {
    const modal = document.getElementById('schoolConnectModal');
    if (modal) {
        modal.classList.add('active');
        window.loadGoogleStatus();
    }
};

window.closeSchoolConnectModal = function() {
    const modal = document.getElementById('schoolConnectModal');
    if (modal) modal.classList.remove('active');
};

window.openAcademicDashboardModal = function() {
    window.closeSchoolConnectModal();
    const modal = document.getElementById('academicDashboardModal');
    if (modal) {
        modal.classList.add('active');
        window.loadAcademicDashboard();
    }
};

window.closeAcademicDashboardModal = function() {
    const modal = document.getElementById('academicDashboardModal');
    if (modal) modal.classList.remove('active');
};

window.openStudyPlannerModal = function() {
    window.closeAcademicDashboardModal();
    const modal = document.getElementById('studyPlannerModal');
    if (modal) {
        modal.classList.add('active');
    }
};

window.closeStudyPlannerModal = function() {
    const modal = document.getElementById('studyPlannerModal');
    if (modal) modal.classList.remove('active');
};

window.connectGoogleService = async function(service) {
    try {
        const res = await fetch(`/api/google/auth_url?service=${encodeURIComponent(service)}`);
        const data = await res.json();
        if (data.configured && data.auth_url) {
            window.location.href = data.auth_url;
        } else if (data.demo_url) {
            window.location.href = data.demo_url;
        } else if (data.auth_url) {
            window.location.href = data.auth_url;
        } else {
            window.location.href = "/api/google/callback?code=demo_student_access";
        }
    } catch (e) {
        console.error("Connect Google error:", e);
        window.location.href = "/api/google/callback?code=demo_student_access";
    }
};

window.saveGoogleCredentials = async function() {
    const cidInput = document.getElementById('googleClientIdInput');
    const secInput = document.getElementById('googleClientSecretInput');
    const clientId = cidInput ? cidInput.value.trim() : '';
    const clientSecret = secInput ? secInput.value.trim() : '';

    if (!clientId || !clientSecret) {
        alert("Please enter both Google Client ID and Client Secret.");
        return;
    }

    try {
        const res = await fetch('/api/google/save_credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            alert("✓ " + data.message);
            window.connectGoogleService('all');
        } else {
            alert("Error saving keys: " + (data.error || "Please try again."));
        }
    } catch (e) {
        alert("Error saving credentials: " + e.message);
    }
};

window.importGcrLink = async function() {
    const input = document.getElementById('gcrLinkInput');
    const val = input ? input.value.trim() : '';
    if (!val) {
        alert("Please enter a Google Classroom link or assignment text.");
        return;
    }
    const btn = document.getElementById('btnImportGcrLink');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Importing...";
    }
    try {
        const res = await fetch('/api/school/import_gcr_link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input_text: val })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (input) input.value = '';
            alert("✓ " + data.message);
            window.loadGoogleStatus();
            window.openAcademicDashboardModal();
        } else {
            alert("Import error: " + (data.error || "Could not parse coursework."));
        }
    } catch (e) {
        alert("Network error importing coursework: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Import Coursework";
        }
    }
};

window.loadGoogleStatus = async function() {
    try {
        const res = await fetch('/api/google/status');
        const data = await res.json();
        
        const badgeCr = document.getElementById('badgeClassroom');
        const badgeCal = document.getElementById('badgeCalendar');
        const badgeGm = document.getElementById('badgeGmail');
        const lastSynced = document.getElementById('schoolLastSyncedText');
        const cidInput = document.getElementById('googleClientIdInput');
        const secInput = document.getElementById('googleClientSecretInput');

        if (data.credentials) {
            if (cidInput && data.credentials.client_id) cidInput.value = data.credentials.client_id;
            if (secInput && data.credentials.client_secret) secInput.value = data.credentials.client_secret;
        }

        const connServices = data.connected_services || {};

        if (badgeCr) {
            if (connServices.google_classroom) {
                badgeCr.innerText = '✓ Connected';
                badgeCr.style.background = 'rgba(16, 185, 129, 0.2)';
                badgeCr.style.color = '#34d399';
                badgeCr.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            } else {
                badgeCr.innerText = 'Not Connected';
                badgeCr.style.background = 'rgba(239, 68, 68, 0.2)';
                badgeCr.style.color = '#f87171';
                badgeCr.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }
        }

        if (badgeCal) {
            if (connServices.google_calendar) {
                badgeCal.innerText = '✓ Connected';
                badgeCal.style.background = 'rgba(16, 185, 129, 0.2)';
                badgeCal.style.color = '#34d399';
                badgeCal.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            } else {
                badgeCal.innerText = 'Not Connected';
                badgeCal.style.background = 'rgba(239, 68, 68, 0.2)';
                badgeCal.style.color = '#f87171';
                badgeCal.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }
        }

        if (badgeGm) {
            if (connServices.gmail) {
                badgeGm.innerText = '✓ Connected';
                badgeGm.style.background = 'rgba(16, 185, 129, 0.2)';
                badgeGm.style.color = '#34d399';
                badgeGm.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            } else {
                badgeGm.innerText = 'Not Connected';
                badgeGm.style.background = 'rgba(239, 68, 68, 0.2)';
                badgeGm.style.color = '#f87171';
                badgeGm.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }
        }

        if (lastSynced) {
            lastSynced.innerText = data.last_synced || 'Never';
        }
    } catch (e) {
        console.error("Load Google status error:", e);
    }
};

window.syncGoogleSchoolData = async function() {
    try {
        const res = await fetch('/api/google/sync', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'ok') {
            window.loadGoogleStatus();
            alert("✓ " + (data.message || "Google School data refreshed!"));
        } else {
            alert("Sync Error: " + (data.error || "Could not sync data. Existing data is still available."));
        }
    } catch (e) {
        alert("Network error syncing Google School data: " + e.message);
    }
};

window.disconnectGoogleServices = async function() {
    if (!confirm("Are you sure you want to disconnect all Google School services? Stored academic items will be cleared.")) return;
    try {
        const res = await fetch('/api/google/disconnect', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'ok') {
            window.loadGoogleStatus();
            alert("Disconnected all Google School services.");
        }
    } catch (e) {
        alert("Error disconnecting: " + e.message);
    }
};

window.loadAcademicDashboard = async function() {
    try {
        const res = await fetch('/api/school/dashboard');
        const data = await res.json();

        const studentName = document.getElementById('dashStudentName');
        const completed = document.getElementById('dashCompletedCount');
        const inProgress = document.getElementById('dashInProgressCount');
        const overdue = document.getElementById('dashOverdueCount');
        const workloadPct = document.getElementById('dashWorkloadPct');
        const priorityFeed = document.getElementById('dashPriorityFeed');
        const subjectFeed = document.getElementById('dashSubjectFeed');

        if (studentName) {
            const nameStr = (data.user_info && data.user_info.name) ? data.user_info.name : 'Student';
            const emailStr = (data.user_info && data.user_info.email) ? ` (${data.user_info.email})` : '';
            const isDemo = data.is_demo_mode;
            const badgeHtml = isDemo 
                ? `<span style="font-size: 0.72rem; padding: 3px 8px; border-radius: 10px; background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.4); margin-left: 8px;">⚡ Demo Mode Active</span>`
                : `<span style="font-size: 0.72rem; padding: 3px 8px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); margin-left: 8px;">🌐 Live Google Account</span>`;
            studentName.innerHTML = `${escapeHtml(nameStr)}${escapeHtml(emailStr)} ${badgeHtml}`;
        }
        if (completed) completed.innerText = data.metrics.completed;
        if (inProgress) inProgress.innerText = data.metrics.in_progress;
        if (overdue) overdue.innerText = data.metrics.overdue;
        if (workloadPct) workloadPct.innerText = `${data.metrics.workload_percentage}%`;

        if (priorityFeed) {
            const items = data.items || [];
            const urgentItems = items.filter(i => i.status !== 'SUBMITTED' && i.status !== 'TURNED_IN');

            if (urgentItems.length === 0) {
                priorityFeed.innerHTML = `
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; color: #34d399; font-size: 0.88rem;">
                        <i class="fa-solid fa-circle-check"></i> Great job! No urgent overdue or pending assignments.
                    </div>
                `;
            } else {
                let html = '';
                urgentItems.forEach(item => {
                    const dueFormatted = item.dueDate ? new Date(item.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No due date';
                    const iconClass = item.source === 'google_classroom' ? 'fa-chalkboard-user' : (item.source === 'google_calendar' ? 'fa-calendar-days' : 'fa-envelope');
                    const badgeColor = item.type === 'exam' ? '#ef4444' : '#f97316';

                    html += `
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <i class="fa-solid ${iconClass}" style="color: ${badgeColor}; font-size: 1.2rem;"></i>
                                <div>
                                    <strong style="color: #f8fafc; font-size: 0.92rem; display: block;">${escapeHtml(item.title)}</strong>
                                    <small style="color: #94a3b8; font-size: 0.78rem;">Subject: <span style="color: #38bdf8;">${escapeHtml(item.subject)}</span> | Due: ${dueFormatted}</small>
                                </div>
                            </div>
                            <span style="font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 12px; background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">
                                ${item.status || 'NOT SUBMITTED'}
                            </span>
                        </div>
                    `;
                });
                priorityFeed.innerHTML = html;
            }
        }

        if (subjectFeed) {
            const stats = data.subject_stats || [];
            if (stats.length === 0) {
                subjectFeed.innerHTML = `<small style="color: #94a3b8;">No subject progress data available yet.</small>`;
            } else {
                let html = '';
                stats.forEach(st => {
                    html += `
                        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 10px 14px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.85rem;">
                                <strong style="color: #f1f5f9;">${escapeHtml(st.subject)}</strong>
                                <span style="color: #fb923c; font-weight: 700;">${st.completed}/${st.total} (${st.percentage}%)</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${st.percentage}%; height: 100%; background: linear-gradient(90deg, #f97316, #facc15); border-radius: 4px; transition: width 0.4s ease;"></div>
                            </div>
                        </div>
                    `;
                });
                subjectFeed.innerHTML = html;
            }
        }

    } catch (e) {
        console.error("Load Academic Dashboard error:", e);
    }
};

window.askAiAboutWorkload = function() {
    window.closeAcademicDashboardModal();
    const input = document.getElementById('chatInput');
    if (input) {
        input.value = "What should I work on today based on my current school workload, upcoming test dates, and deadlines?";
        window.sendMessage();
    }
};

window.generateAiStudyPlan = async function() {
    const durationSelect = document.getElementById('studyDurationSelect');
    const durationMins = durationSelect ? durationSelect.value : 60;
    const outputContainer = document.getElementById('studyPlanOutputContainer');

    try {
        if (outputContainer) outputContainer.style.display = 'block';
        const slotsDiv = document.getElementById('planTimeSlots');
        if (slotsDiv) slotsDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #fb923c;"><i class="fa-solid fa-spinner fa-spin"></i> HeatGPT AI is generating your personalized study plan...</div>`;

        const res = await fetch('/api/school/study_plan_generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration_minutes: durationMins })
        });

        const data = await res.json();
        if (data.status === 'ok' && data.plan) {
            const plan = data.plan;
            const pTitle = document.getElementById('planTitle');
            const pSummary = document.getElementById('planSummary');
            const pTakeaway = document.getElementById('planTakeaway');

            if (pTitle) pTitle.innerText = plan.title || `${durationMins}-Minute Power Study Session`;
            if (pSummary) pSummary.innerText = plan.summary || 'Prioritizing your urgent Google Classroom assignments and upcoming test prep.';
            if (pTakeaway) pTakeaway.innerText = plan.key_takeaway || 'Stay focused and take rest breaks to preserve retention.';

            if (slotsDiv && plan.schedule) {
                let html = '';
                plan.schedule.forEach((slot, idx) => {
                    const isBreak = (slot.subject || '').toLowerCase().includes('break');
                    html += `
                        <div style="background: ${isBreak ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${isBreak ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <input type="checkbox" id="planCheck_${idx}" style="width: 18px; height: 18px; accent-color: #f97316; cursor: pointer;">
                                <div>
                                    <strong style="color: #f8fafc; font-size: 0.9rem;">${escapeHtml(slot.task)}</strong>
                                    <small style="color: #94a3b8; display: block; font-size: 0.78rem;">${escapeHtml(slot.description || '')}</small>
                                </div>
                            </div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: ${isBreak ? '#38bdf8' : '#fb923c'}; background: rgba(255, 255, 255, 0.05); padding: 4px 10px; border-radius: 12px;">
                                ${escapeHtml(slot.time_slot || slot.duration)}
                            </span>
                        </div>
                    `;
                });
                slotsDiv.innerHTML = html;
            }
        } else {
            alert("Error generating study plan: " + (data.error || "Please try again."));
        }
    } catch (e) {
        alert("Network error generating study plan: " + e.message);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('google_connected')) {
        setTimeout(() => {
            window.openAcademicDashboardModal();
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
    }
});

