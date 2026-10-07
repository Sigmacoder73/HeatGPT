/* ==========================================================================
   NOVA AI - STUDY TOOLS SUITE (Quizzer, 3D Flashcards, Pomodoro & Lo-Fi Synth)
   ========================================================================== */

class StudyToolsManager {
    constructor() {
        // --- Flashcard Data Decks (Expanded Concept-Based Decks) ---
        this.flashcardDecks = {
            mlTerms: [
                { cat: "ML Concept 🧠", front: "Supervised vs Unsupervised", back: "Supervised algorithms learn from labeled target data (X -> y); Unsupervised algorithms discover hidden patterns and clusters in unlabeled data (X)." },
                { cat: "ML Concept 🧠", front: "Overfitting vs Underfitting", back: "Overfitting = High Variance (memorizes noise, fails on test data); Underfitting = High Bias (too simple, fails on both train and test data)." },
                { cat: "ML Mechanism ⚡", front: "Backpropagation", back: "Uses the mathematical Chain Rule to compute loss gradients relative to each weight, guiding Gradient Descent updates backward." },
                { cat: "ML Mechanism ⚡", front: "Activation Functions (ReLU)", back: "Introduces non-linearity into neural networks. ReLU converts negative inputs to 0 and keeps positive values, enabling deep learning." },
                { cat: "ML Metric 📊", front: "Loss Function", back: "Quantifies the mathematical error between predicted outputs and true ground-truth targets (e.g. Mean Squared Error, Cross-Entropy)." },
                { cat: "ML Optimization 🚀", front: "Gradient Descent", back: "Iterative optimization algorithm that steps down the loss curve in the direction of steepest negative gradient to find optimal weights." },
                { cat: "ML Engineering 💻", front: "Train-Test Data Split", back: "Dividing data (e.g. 80/20 ratio) to evaluate true model generalization on unseen evaluation data without data leakage." },
                { cat: "ML Hyperparameter ⚙️", front: "Learning Rate", back: "Controls step size during weight updates. Too high causes training divergence; too low results in extremely slow convergence." },
                { cat: "ML Concept 🧠", front: "Feature Scaling / Normalization", back: "Rescaling numeric features to a standard range (0-1 or z-score) so large magnitude features don't distort gradient updates." },
                { cat: "ML Best Practice 💡", front: "Regularization (L1/L2)", back: "Adding weight penalty terms to the loss function to constrain model complexity and prevent overfitting." }
            ],
            algebra: [
                { cat: "Algebra 1 📐", front: "Slope (m) as Rate of Change", back: "Measures steepness: m = (y2 - y1) / (x2 - x1) = Rise over Run. It represents how fast y changes per 1 unit change in x." },
                { cat: "Algebra 1 📐", front: "y-Intercept (b)", back: "The starting baseline value of y when input x equals 0. The point where the graph crosses the vertical y-axis (0, b)." },
                { cat: "Algebra 1 📐", front: "System of Linear Equations", back: "Multiple linear equations sharing variables. The solution (x, y) is the exact geometric intersection point of their lines." },
                { cat: "Algebra 1 📐", front: "Inverse Operations", back: "Operations that undo each other: Addition <-> Subtraction, Multiplication <-> Division. Used to isolate variables." },
                { cat: "Algebra 1 📐", front: "Function Notation f(x)", back: "f(x) maps an input value x to a unique output f(x). It acts like an automated mathematical machine." },
                { cat: "Algebra 1 📐", front: "Quadratic Formula", back: "x = (-b ± √(b² - 4ac)) / (2a). Finds the roots (x-intercepts) where a quadratic parabola equals zero." },
                { cat: "Algebra 1 📐", front: "Exponent Product Rule", back: "(a^m)(a^n) = a^(m+n). When multiplying powers with matching bases, add the exponents together." },
                { cat: "Algebra 1 📐", front: "Vertical Shift Transformation", back: "f(x) + c shifts a graph UP by c units; f(x) - c shifts a graph DOWN by c units." },
                { cat: "Algebra 1 📐", front: "Domain vs Range", back: "Domain = set of all possible input x-values; Range = set of all resulting output y-values." }
            ],
            science: [
                { cat: "Science 🧪", front: "Energy Transformation in Photosynthesis", back: "Plants absorb photon light energy to break and reassemble CO2 and H2O into chemical glucose bond energy (C6H12O6) + O2." },
                { cat: "Physics ⚡", front: "Newton's 1st Law (Inertia)", back: "An object remains at rest or moves at a constant velocity unless acted upon by an unbalanced external net force." },
                { cat: "Physics ⚡", front: "Newton's 2nd Law (F = m·a)", back: "Acceleration is directly proportional to net force and inversely proportional to object mass." },
                { cat: "Chemistry ⚛️", front: "Valence Electrons & Octet Rule", back: "Outermost shell electrons determine chemical bonding. Atoms trade or share electrons to achieve stable 8-electron shells." },
                { cat: "Physics ⚡", front: "Kinetic vs Potential Energy", back: "Kinetic = Energy of motion (1/2 mv²); Potential = Stored position energy in a gravitational or electric field (mgh)." },
                { cat: "Chemistry ⚛️", front: "Chemical vs Physical Change", back: "Chemical changes rearrange atomic bonds to create new substances; Physical changes alter state/appearance without altering molecular identity." },
                { cat: "Physics ⚡", front: "Conservation of Energy", back: "Energy cannot be created or destroyed, only transformed from one state to another (e.g. PE <-> KE in a pendulum)." },
                { cat: "Biology 🌿", front: "Cellular Respiration", back: "Mitochondria break down glucose with oxygen to produce ATP chemical energy, releasing CO2 and water as byproducts." },
                { cat: "Chemistry ⚛️", front: "Atomic Number vs Mass Number", back: "Atomic Number = number of Protons (defines element); Mass Number = Protons + Neutrons in the nucleus." }
            ],
            custom: [],
            aiGenerated: []
        };

        this.currentDeckKey = 'mlTerms';
        this.currentCardIndex = 0;

        // --- Pomodoro State ---
        this.pomoTotalTime = 25 * 60;
        this.pomoRemaining = 25 * 60;
        this.pomoTimerId = null;
        this.pomoIsRunning = false;

        // --- Audio Context for Synth Lo-Fi ---
        this.audioCtx = null;
        this.synthPlaying = false;
        this.activeSoundMode = 'space';
        this.synthNodes = [];
    }

    // =========================================================================
    // QUIZZER LOGIC
    // =========================================================================
    startQuiz(subjectKey) {
        let questions = [];

        if (subjectKey === 'dynamic' && this.quizData && this.quizData.dynamic && this.quizData.dynamic.length > 0) {
            questions = this.quizData.dynamic;
        } else {
            // Fallback to generating questions via AIEngine
            const topicName = (subjectKey === 'math' ? 'Algebra 1' : (subjectKey === 'science' ? 'Physical Science' : 'Machine Learning'));
            questions = window.aiEngine.generateQuizQuestions(topicName, 'medium');
        }

        this.currentQuiz = {
            questions: questions,
            index: 0,
            score: 0
        };

        const hero = document.querySelector('.quiz-hero');
        const card = document.getElementById('quizCard');
        
        if (hero) hero.classList.add('hidden');
        if (card) card.classList.remove('hidden');

        this.renderCurrentQuestion();
    }

    renderCurrentQuestion() {
        const q = this.currentQuiz.questions[this.currentQuiz.index];
        const total = this.currentQuiz.questions.length;

        document.getElementById('qNumber').textContent = `Question ${this.currentQuiz.index + 1} of ${total}`;
        document.getElementById('qScore').textContent = `Score: ${this.currentQuiz.score}`;
        document.getElementById('qText').textContent = q.q;
        document.getElementById('quizFill').style.width = `${((this.currentQuiz.index + 1) / total) * 100}%`;

        const grid = document.getElementById('optionsGrid');
        grid.innerHTML = '';

        q.options.forEach((optText, idx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-opt-btn';
            btn.textContent = `${String.fromCharCode(65 + idx)}. ${optText}`;
            btn.onclick = () => this.handleOptionClick(idx, btn);
            grid.appendChild(btn);
        });

        const feedback = document.getElementById('quizFeedback');
        const nextBtn = document.getElementById('nextQBtn');
        feedback.classList.add('hidden');
        nextBtn.classList.add('hidden');
    }

    handleOptionClick(selectedIndex, clickedBtn) {
        const q = this.currentQuiz.questions[this.currentQuiz.index];
        const allBtns = document.querySelectorAll('.quiz-opt-btn');
        allBtns.forEach(b => b.disabled = true);

        const feedback = document.getElementById('quizFeedback');
        const nextBtn = document.getElementById('nextQBtn');

        if (selectedIndex === q.correct) {
            clickedBtn.classList.add('correct');
            this.currentQuiz.score += 1;
            feedback.className = 'quiz-feedback correct';
            feedback.innerHTML = `<strong>🏆 Correct!</strong> ${q.exp}`;
            this.playBeep(600, 0.15);
        } else {
            clickedBtn.classList.add('incorrect');
            allBtns[q.correct].classList.add('correct');
            feedback.className = 'quiz-feedback incorrect';
            feedback.innerHTML = `<strong>❌ Incorrect.</strong> ${q.exp}`;
            this.playBeep(250, 0.25);
        }

        feedback.classList.remove('hidden');
        nextBtn.classList.remove('hidden');

        if (this.currentQuiz.index === this.currentQuiz.questions.length - 1) {
            nextBtn.textContent = 'Finish Quiz (+100 XP) 🏆';
        } else {
            nextBtn.innerHTML = 'Next Question <i class="fa-solid fa-arrow-right"></i>';
        }
    }

    nextQuestion() {
        this.currentQuiz.index += 1;
        if (this.currentQuiz.index < this.currentQuiz.questions.length) {
            this.renderCurrentQuestion();
        } else {
            // Quiz Complete
            if (window.gamification) {
                window.gamification.addXp(100, "Quiz Completed");
            }
            alert(`🎉 Quiz Finished! Final Score: ${this.currentQuiz.score} / ${this.currentQuiz.questions.length}`);
            document.querySelector('.quiz-hero').classList.remove('hidden');
            document.getElementById('quizCard').classList.add('hidden');
        }
    }

    // =========================================================================
    // 3D FLASHCARD LOGIC
    // =========================================================================
    loadDeck(deckKey) {
        this.currentDeckKey = deckKey;
        this.currentCardIndex = 0;
        
        if (deckKey === 'custom' && window.gamification) {
            this.flashcardDecks.custom = window.gamification.stats.savedFlashcards || [];
        }

        document.querySelectorAll('.deck-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.deck === deckKey);
        });

        this.renderCard();
    }

    renderCard() {
        const deck = this.flashcardDecks[this.currentDeckKey] || this.flashcardDecks.mlTerms;
        const cardEl = document.getElementById('mainFlashcard');
        cardEl.classList.remove('flipped');

        if (!deck || deck.length === 0) {
            document.getElementById('cardCategory').textContent = 'Empty Deck';
            document.getElementById('cardFrontText').textContent = 'No Flashcards Here Yet!';
            document.getElementById('cardCategoryBack').textContent = 'Info';
            document.getElementById('cardBackText').textContent = 'Add custom cards below or ask NOVA to make flashcards in chat!';
            document.getElementById('cardCounterText').textContent = '0 / 0';
            return;
        }

        const currentCard = deck[this.currentCardIndex];
        document.getElementById('cardCategory').textContent = currentCard.cat || 'Concept';
        document.getElementById('cardFrontText').textContent = currentCard.front;
        document.getElementById('cardCategoryBack').textContent = (currentCard.cat || 'Concept') + ' (Explanation)';
        document.getElementById('cardBackText').textContent = currentCard.back;
        document.getElementById('cardCounterText').textContent = `Card ${this.currentCardIndex + 1} / ${deck.length}`;
    }

    nextCard() {
        const deck = this.flashcardDecks[this.currentDeckKey];
        if (!deck || deck.length === 0) return;
        this.currentCardIndex = (this.currentCardIndex + 1) % deck.length;
        this.renderCard();
    }

    prevCard() {
        const deck = this.flashcardDecks[this.currentDeckKey];
        if (!deck || deck.length === 0) return;
        this.currentCardIndex = (this.currentCardIndex - 1 + deck.length) % deck.length;
        this.renderCard();
    }

    addCustomCard(front, back) {
        if (!front || !back) return;
        const newCard = { cat: "Custom ⭐", front: front.trim(), back: back.trim() };
        
        if (!window.gamification.stats.savedFlashcards) {
            window.gamification.stats.savedFlashcards = [];
        }
        window.gamification.stats.savedFlashcards.push(newCard);
        window.gamification.saveStats();
        
        document.getElementById('savedCardCount').textContent = window.gamification.stats.savedFlashcards.length;
        
        this.loadDeck('custom');
        alert("✨ Saved flashcard to your custom deck!");
    }

    // =========================================================================
    // POMODORO TIMER LOGIC
    // =========================================================================
    startPomodoro() {
        if (this.pomoIsRunning) return;
        this.pomoIsRunning = true;

        document.getElementById('startPomoBtn').classList.add('hidden');
        document.getElementById('pausePomoBtn').classList.remove('hidden');

        this.pomoTimerId = setInterval(() => {
            if (this.pomoRemaining > 0) {
                this.pomoRemaining -= 1;
                this.updatePomoDisplay();
            } else {
                this.pausePomodoro();
                this.playBeep(800, 0.5);
                alert("🎉 25-Minute Focus Session Completed! +150 XP Earned!");
                if (window.gamification) {
                    window.gamification.addXp(150, "Pomodoro Session");
                }
                this.resetPomodoro();
            }
        }, 1000);
    }

    pausePomodoro() {
        this.pomoIsRunning = false;
        clearInterval(this.pomoTimerId);
        document.getElementById('startPomoBtn').classList.remove('hidden');
        document.getElementById('pausePomoBtn').classList.add('hidden');
    }

    resetPomodoro() {
        this.pausePomodoro();
        this.pomoRemaining = this.pomoTotalTime;
        this.updatePomoDisplay();
    }

    updatePomoDisplay() {
        const mins = Math.floor(this.pomoRemaining / 60);
        const secs = this.pomoRemaining % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        document.getElementById('pomoTimeDisplay').textContent = formatted;

        const ring = document.getElementById('pomoRing');
        if (ring) {
            const circumference = 691;
            const progress = this.pomoRemaining / this.pomoTotalTime;
            const offset = circumference * (1 - progress);
            ring.style.strokeDashoffset = offset;
        }
    }

    // =========================================================================
    // SYNTHESIZED LO-FI AUDIO (Web Audio API)
    // =========================================================================
    toggleAmbientAudio() {
        if (this.synthPlaying) {
            this.stopAmbientAudio();
        } else {
            this.startAmbientAudio();
        }
    }

    startAmbientAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.stopAmbientAudio();
        this.synthPlaying = true;
        
        const btn = document.getElementById('toggleAmbientBtn');
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Stop Ambient Audio';
        }

        if (this.activeSoundMode === 'space') {
            const osc1 = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const filter = this.audioCtx.createBiquadFilter();
            const gain = this.audioCtx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(110, this.audioCtx.currentTime);
            
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(164.81, this.audioCtx.currentTime);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, this.audioCtx.currentTime);

            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc1.start();
            osc2.start();
            this.synthNodes = [osc1, osc2, gain];
        } else if (this.activeSoundMode === 'rain') {
            const bufferSize = this.audioCtx.sampleRate * 2;
            const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = this.audioCtx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
            filter.Q.setValueAtTime(0.5, this.audioCtx.currentTime);

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);

            whiteNoise.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            whiteNoise.start();
            this.synthNodes = [whiteNoise, gain];
        } else {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(130.81, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            this.synthNodes = [osc, gain];
        }
    }

    stopAmbientAudio() {
        this.synthNodes.forEach(node => {
            if (node.stop) node.stop();
            if (node.disconnect) node.disconnect();
        });
        this.synthNodes = [];
        this.synthPlaying = false;

        const btn = document.getElementById('toggleAmbientBtn');
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-headphones"></i> Play Lo-Fi Ambient Synth';
        }
    }

    setSoundMode(mode) {
        this.activeSoundMode = mode;
        document.querySelectorAll('.sound-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.sound === mode);
        });
        if (this.synthPlaying) {
            this.startAmbientAudio();
        }
    }

    playBeep(freq, duration) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = freq;
            gain.gain.value = 0.1;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            // Audio context blocked
        }
    }
}

window.studyToolsManager = new StudyToolsManager();
