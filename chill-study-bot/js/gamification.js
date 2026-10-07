/* ==========================================================================
   NOVA AI - GAMIFICATION SYSTEM (XP, Levels, Streaks)
   ========================================================================== */

class GamificationManager {
    constructor() {
        this.storageKey = 'nova_student_stats_v1';
        this.stats = this.loadStats();
    }

    loadStats() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved stats:", e);
            }
        }
        return {
            xp: 120,
            streak: 3,
            lastStudyDate: new Date().toISOString().split('T')[0],
            savedFlashcards: []
        };
    }

    saveStats() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.stats));
        this.updateUI();
    }

    addXp(amount, reason = "") {
        this.stats.xp += amount;
        this.checkStreak();
        this.saveStats();
        this.showXpNotification(`+${amount} XP ${reason ? '(' + reason + ')' : ''}`);
    }

    checkStreak() {
        const today = new Date().toISOString().split('T')[0];
        if (this.stats.lastStudyDate !== today) {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (this.stats.lastStudyDate === yesterday) {
                this.stats.streak += 1;
            } else {
                this.stats.streak = 1;
            }
            this.stats.lastStudyDate = today;
        }
    }

    getLevelInfo() {
        // Level calculation formula: Level N requires N * 400 XP
        const xp = this.stats.xp;
        const levelRanks = [
            { level: 1, name: "AI Novice 🚀", reqXp: 300 },
            { level: 2, name: "Script Apprentice 💻", reqXp: 750 },
            { level: 3, name: "ML Explorer 🤖", reqXp: 1400 },
            { level: 4, name: "Automation Wiz ⚡", reqXp: 2200 },
            { level: 5, name: "Neural Networker 🧠", reqXp: 3200 },
            { level: 6, name: "Data Architect 📊", reqXp: 4500 },
            { level: 7, name: "Agent Builder 🛠️", reqXp: 6000 },
            { level: 8, name: "Automation Mastermind 👑", reqXp: 8000 }
        ];

        let currentRank = levelRanks[0];
        let nextRankXp = levelRanks[0].reqXp;

        for (let i = 0; i < levelRanks.length; i++) {
            if (xp >= levelRanks[i].reqXp) {
                currentRank = levelRanks[i];
                nextRankXp = levelRanks[i + 1] ? levelRanks[i + 1].reqXp : levelRanks[i].reqXp + 2000;
            } else {
                break;
            }
        }

        const prevReq = currentRank.level === 1 ? 0 : levelRanks[currentRank.level - 2].reqXp;
        const progressXp = xp - prevReq;
        const targetXp = nextRankXp - prevReq;
        const percentage = Math.min(100, Math.max(5, Math.floor((progressXp / targetXp) * 100)));

        return {
            level: currentRank.level,
            rankName: currentRank.name,
            currentXp: xp,
            nextXp: nextRankXp,
            progressPercentage: percentage
        };
    }

    updateUI() {
        const info = this.getLevelInfo();
        const rankEl = document.getElementById('userRank');
        const xpFillEl = document.getElementById('xpBarFill');
        const xpTextEl = document.getElementById('xpText');
        const streakEl = document.getElementById('streakCount');

        if (rankEl) rankEl.textContent = `Level ${info.level}: ${info.rankName}`;
        if (xpFillEl) xpFillEl.style.width = `${info.progressPercentage}%`;
        if (xpTextEl) xpTextEl.textContent = `${info.currentXp} / ${info.nextXp} XP`;
        if (streakEl) streakEl.textContent = this.stats.streak;
    }

    showXpNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'xp-toast';
        toast.innerHTML = `<i class="fa-solid fa-bolt"></i> ${message}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #00f0ff, #3b82f6);
            color: #fff;
            padding: 0.6rem 1.2rem;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 0.85rem;
            box-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
            z-index: 9999;
            animation: bounceIn 0.4s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 2200);
    }

    resetProgress() {
        this.stats = {
            xp: 0,
            streak: 1,
            lastStudyDate: new Date().toISOString().split('T')[0],
            savedFlashcards: []
        };
        this.saveStats();
    }
}

window.gamification = new GamificationManager();
