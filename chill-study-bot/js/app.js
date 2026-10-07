/* ==========================================================================
   NOVA AI - MAIN GENERAL-PURPOSE APPLICATION CONTROLLER
   ========================================================================== */

class AppController {
    constructor() {
        this.currentTab = 'chat-tab';
        this.globalTtsEnabled = false;
        this.speechRecognition = null;
        this.isRecording = false;
    }

    init() {
        this.bindNavigation();
        this.bindChatEvents();
        this.bindMLLabEvents();
        this.bindPomodoroEvents();
        this.bindSettingsModal();
        this.initSpeechRecognition();

        // Initial UI state setup
        if (window.gamification) window.gamification.updateUI();
        if (window.mlLabManager) {
            window.mlLabManager.initCanvas();
            window.mlLabManager.loadRecipe('fileSorter');
        }

        const ttsBtn = document.getElementById('globalTtsToggle');
        if (ttsBtn) {
            ttsBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Voice OFF';
            ttsBtn.classList.remove('active');
        }
    }

    // =========================================================================
    // NAVIGATION & TAB SWITCHING
    // =========================================================================
    bindNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.dataset.tab;
                this.switchTab(targetTab);
            });
        });

        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('appSidebar');
        if (menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }

        const slangSelect = document.getElementById('slangSelect');
        if (slangSelect) {
            slangSelect.addEventListener('change', (e) => {
                window.aiEngine.setSlangLevel(e.target.value);
            });
        }

        const ttsBtn = document.getElementById('globalTtsToggle');
        if (ttsBtn) {
            ttsBtn.addEventListener('click', () => {
                this.globalTtsEnabled = !this.globalTtsEnabled;
                ttsBtn.innerHTML = this.globalTtsEnabled 
                    ? '<i class="fa-solid fa-volume-high"></i> Voice ON' 
                    : '<i class="fa-solid fa-volume-xmark"></i> Voice OFF';
                ttsBtn.classList.toggle('active', this.globalTtsEnabled);
            });
        }
    }

    switchTab(tabId) {
        this.currentTab = tabId;

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.toggle('active', tab.id === tabId);
        });

        const titles = {
            'chat-tab': { main: 'NOVA AI Assistant 💬', sub: 'Your all-in-one AI assistant. Ask questions, generate code, write text, or brainstorm ideas!' },
            'ml-tab': { main: 'Code & Automation Studio 🤖', sub: 'Explore Python automation recipes & interactive neural network visualizations!' },
            'pomodoro-tab': { main: 'Focus Mode & Ambient Audio ⏱️', sub: '25-minute focus session with Web Audio synthesized soundscapes!' }
        };

        if (titles[tabId]) {
            document.getElementById('modeTitle').textContent = titles[tabId].main;
            document.getElementById('modeSubtitle').textContent = titles[tabId].sub;
        }

        if (tabId === 'ml-tab') {
            setTimeout(() => window.mlLabManager.initCanvas(), 100);
        }
    }

    // =========================================================================
    // CHAT ENGINE
    // =========================================================================
    bindChatEvents() {
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        const promptChips = document.querySelectorAll('.prompt-chip');

        if (sendBtn) sendBtn.addEventListener('click', () => this.handleSendMessage());

        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }

        promptChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.dataset.prompt;
                if (prompt) {
                    chatInput.value = prompt;
                    this.handleSendMessage();
                }
            });
        });
    }

    async handleSendMessage() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        this.renderMessage(text, 'user');

        const typingId = this.renderTypingIndicator();

        try {
            const responseText = await window.aiEngine.generateResponse(text);
            this.removeTypingIndicator(typingId);
            this.renderMessage(responseText, 'nova');

            if (this.globalTtsEnabled) {
                this.speakText(responseText);
            }
        } catch (err) {
            this.removeTypingIndicator(typingId);
            this.renderMessage("Something went wrong processing your request. Please try again!", 'nova');
        }
    }

    renderMessage(content, sender) {
        const container = document.getElementById('chatMessages');
        const card = document.createElement('div');
        card.className = `message-card ${sender === 'user' ? 'user-message' : 'nova-message'}`;

        const isUser = sender === 'user';
        const avatarHtml = isUser 
            ? `<div class="avatar user-avatar-msg"><i class="fa-solid fa-user"></i></div>`
            : `<div class="avatar nova-avatar"><i class="fa-solid fa-robot"></i></div>`;

        const name = isUser ? 'You' : 'NOVA';
        const badge = isUser ? '' : `<span class="bot-badge">ChatGPT AI</span>`;

        const formattedContent = this.formatMarkdown(content);

        const actionsHtml = isUser ? '' : `
            <div class="message-actions">
                <button class="action-btn speaking-btn" onclick="app.speakMessage(this)"><i class="fa-solid fa-volume-high"></i> Listen</button>
                <button class="action-btn" onclick="app.copyText(this)"><i class="fa-solid fa-copy"></i> Copy</button>
            </div>
        `;

        card.innerHTML = `
            ${avatarHtml}
            <div class="message-body">
                <div class="message-header">
                    <span class="bot-name">${name}</span>
                    ${badge}
                    <span class="msg-time">Just now</span>
                </div>
                <div class="message-text">
                    ${formattedContent}
                </div>
                ${actionsHtml}
            </div>
        `;

        container.appendChild(card);
        container.scrollTop = container.scrollHeight;
    }

    renderTypingIndicator() {
        const container = document.getElementById('chatMessages');
        const id = 'typing_' + Date.now();
        const card = document.createElement('div');
        card.id = id;
        card.className = 'message-card nova-message';
        card.innerHTML = `
            <div class="avatar nova-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-body">
                <div class="message-text">
                    <p><em>NOVA is thinking... ⚡</em></p>
                </div>
            </div>
        `;
        container.appendChild(card);
        container.scrollTop = container.scrollHeight;
        return id;
    }

    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    formatMarkdown(raw) {
        let text = raw;
        text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/`(.*?)`/g, '<code style="background:rgba(0,240,255,0.15); color:#00f0ff; padding:0.1rem 0.35rem; border-radius:4px;">$1</code>');
        text = text.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
        text = text.replace(/^\* (.*$)/gim, '<li>$1</li>');
        text = text.replace(/^- (.*$)/gim, '<li>$1</li>');

        if (text.includes('<li>')) {
            text = text.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
            text = text.replace(/<\/ul>\s*<ul>/g, '');
        }

        const paragraphs = text.split('\n\n').map(p => {
            if (p.startsWith('<h3') || p.startsWith('<h4') || p.startsWith('<pre') || p.startsWith('<blockquote') || p.startsWith('<ul')) {
                return p;
            }
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');

        return paragraphs;
    }

    escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // =========================================================================
    // SPEECH SYNTHESIS & RECOGNITION (STT / TTS)
    // =========================================================================
    initSpeechRecognition() {
        const micBtn = document.getElementById('micBtn');
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRec) {
            if (micBtn) micBtn.title = "Speech recognition not supported in this browser";
            return;
        }

        this.speechRecognition = new SpeechRec();
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = false;

        this.speechRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById('chatInput');
            if (input) {
                input.value = transcript;
                this.handleSendMessage();
            }
        };

        this.speechRecognition.onend = () => {
            this.isRecording = false;
            if (micBtn) micBtn.classList.remove('recording');
        };

        if (micBtn) {
            micBtn.addEventListener('click', () => {
                if (this.isRecording) {
                    this.speechRecognition.stop();
                } else {
                    this.speechRecognition.start();
                    this.isRecording = true;
                    micBtn.classList.add('recording');
                }
            });
        }
    }

    speakText(rawText) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        const cleanText = rawText.replace(/<[^>]*>?/gm, '').replace(/[\*#`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText.substring(0, 300));
        
        const speedVal = parseFloat(document.getElementById('voiceSpeedRange')?.value || '1.0');
        utterance.rate = speedVal;

        window.speechSynthesis.speak(utterance);
    }

    speakMessage(btn) {
        const msgBody = btn.closest('.message-body');
        if (msgBody) {
            const text = msgBody.querySelector('.message-text').innerText;
            this.speakText(text);
        }
    }

    copyText(btn) {
        const msgBody = btn.closest('.message-body');
        if (msgBody) {
            const text = msgBody.querySelector('.message-text').innerText;
            navigator.clipboard.writeText(text);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
            }, 2000);
        }
    }

    // =========================================================================
    // EVENT BINDINGS FOR OTHER TABS & SETTINGS
    // =========================================================================
    bindMLLabEvents() {
        const btnPulse = document.getElementById('btnPulseNet');
        const btnReset = document.getElementById('btnResetNet');
        const recipeBtns = document.querySelectorAll('.recipe-btn');
        const copyRecipeBtn = document.getElementById('btnCopyRecipe');

        if (btnPulse) btnPulse.addEventListener('click', () => window.mlLabManager.pulseNetwork());
        if (btnReset) btnReset.addEventListener('click', () => window.mlLabManager.initCanvas());

        recipeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                window.mlLabManager.loadRecipe(btn.dataset.recipe);
            });
        });

        if (copyRecipeBtn) {
            copyRecipeBtn.addEventListener('click', () => {
                const code = document.getElementById('recipeCode').innerText;
                navigator.clipboard.writeText(code);
                copyRecipeBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => copyRecipeBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Code', 2000);
            });
        }
    }

    bindPomodoroEvents() {
        const startBtn = document.getElementById('startPomoBtn');
        const pauseBtn = document.getElementById('pausePomoBtn');
        const resetBtn = document.getElementById('resetPomoBtn');
        const audioToggleBtn = document.getElementById('toggleAmbientBtn');
        const soundChips = document.querySelectorAll('.sound-chip');

        if (startBtn) startBtn.addEventListener('click', () => window.studyToolsManager.startPomodoro());
        if (pauseBtn) pauseBtn.addEventListener('click', () => window.studyToolsManager.pausePomodoro());
        if (resetBtn) resetBtn.addEventListener('click', () => window.studyToolsManager.resetPomodoro());

        if (audioToggleBtn) audioToggleBtn.addEventListener('click', () => window.studyToolsManager.toggleAmbientAudio());

        soundChips.forEach(chip => {
            chip.addEventListener('click', () => window.studyToolsManager.setSoundMode(chip.dataset.sound));
        });
    }

    bindSettingsModal() {
        const openBtn = document.getElementById('openSettingsBtn');
        const closeBtn = document.getElementById('closeSettingsBtn');
        const saveBtn = document.getElementById('saveSettingsBtn');
        const resetXpBtn = document.getElementById('resetXpBtn');
        const modal = document.getElementById('settingsModal');
        const apiKeyInput = document.getElementById('geminiApiKey');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                if (apiKeyInput) apiKeyInput.value = window.aiEngine.getApiKey();
                modal.classList.remove('hidden');
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (apiKeyInput) window.aiEngine.setApiKey(apiKeyInput.value);
                modal.classList.add('hidden');
                alert("⚙️ Settings saved!");
            });
        }

        if (resetXpBtn) {
            resetXpBtn.addEventListener('click', () => {
                if (confirm("Reset local settings and data?")) {
                    if (window.gamification) window.gamification.resetProgress();
                    modal.classList.add('hidden');
                }
            });
        }
    }
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
    window.app.init();
});
