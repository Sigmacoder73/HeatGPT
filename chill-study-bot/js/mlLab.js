/* ==========================================================================
   NOVA AI - MACHINE LEARNING & AUTOMATION STUDIO (Canvas & Code)
   ========================================================================== */

class MLLabManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.animating = false;
        this.pulses = [];
        
        this.recipes = {
            fileSorter: {
                title: "auto_file_sorter.py",
                code: `import os
import shutil

# Target directory (e.g. Downloads or Homework folder)
DOWNLOADS_DIR = os.path.expanduser("~/Downloads")

CATEGORIES = {
    "PDF_Homework": [".pdf"],
    "Images": [".png", ".jpg", ".jpeg"],
    "Python_Scripts": [".py", ".ipynb"],
    "Documents": [".docx", ".pptx", ".xlsx"]
}

def auto_organize():
    for filename in os.listdir(DOWNLOADS_DIR):
        filepath = os.path.join(DOWNLOADS_DIR, filename)
        if os.path.isfile(filepath):
            ext = os.path.splitext(filename)[1].lower()
            for folder_name, exts in CATEGORIES.items():
                if ext in exts:
                    dest_dir = os.path.join(DOWNLOADS_DIR, folder_name)
                    os.makedirs(dest_dir, exist_ok=True)
                    shutil.move(filepath, os.path.join(dest_dir, filename))
                    print(f"✅ Moved: {filename} -> {folder_name}/")

if __name__ == "__main__":
    auto_organize()
    print("🚀 Downloads folder organized automatically!")`,
                explanation: "<strong>📂 Auto File Sorter:</strong> Uses Python's built-in `os` and `shutil` libraries to automatically inspect extensions of downloaded files and move them into designated subfolders. Perfect for keeping your school downloads clean!"
            },
            homeworkBot: {
                title: "homework_reminder_bot.py",
                code: `import time
from datetime import datetime

homework_tasks = [
    {"subject": "Algebra 1", "task": "Page 142 #1-15", "due": "18:00"},
    {"subject": "Physical Science", "task": "Photosynthesis Worksheet", "due": "19:30"}
]

print("🤖 NOVA Homework Reminder Bot is Running...")

while True:
    now_str = datetime.now().strftime("%H:%M")
    for item in homework_tasks:
        if now_str == item["due"]:
            print(f"⏰ REMINDER! Time to lock in on {item['subject']}: {item['task']} 🔒")
    
    time.sleep(30) # Check every 30 seconds`,
                explanation: "<strong>🤖 HW Reminder Bot:</strong> Runs a light continuous loop checking system time against your daily homework task list. Triggers a loud reminder right when it's time to start!"
            },
            webScraper: {
                title: "web_quote_scraper.py",
                code: `import requests
from bs4 import BeautifulSoup

url = "https://quotes.toscrape.com/"
response = requests.get(url)

if response.status_code == 200:
    soup = BeautifulSoup(response.text, "html.parser")
    quotes = soup.find_all("span", class_="text")
    authors = soup.find_all("small", class_="author")

    print("🔥 TOP MOTIVATIONAL QUOTES FOR STUDYING:\n")
    for i in range(min(5, len(quotes))):
        print(f"{i+1}. {quotes[i].text}")
        print(f"   — Author: {authors[i].text}\n")`,
                explanation: "<strong>🌐 Web Quote Scraper:</strong> Uses `requests` and `BeautifulSoup` to fetch HTML from a webpage, parse quotes and authors, and display them in your terminal for instant motivation!"
            },
            miniML: {
                title: "10_line_ml_classifier.py",
                code: `from sklearn.tree import DecisionTreeClassifier

# Feature Dataset: [Study Hours, Sleep Hours, Practice Tests Completed]
X_train = [
    [1, 5, 0],  # Did not pass
    [2, 6, 1],  # Did not pass
    [4, 7, 2],  # Passed
    [6, 8, 3],  # Passed
    [8, 9, 4]   # Passed (Top grade)
]

# Target Labels: 0 = Fail, 1 = Pass
y_train = [0, 0, 1, 1, 1]

# Initialize Decision Tree ML Model & Train (Fit)
clf = DecisionTreeClassifier()
clf.fit(X_train, y_train)

# Predict for a new student: 5 hrs study, 7 hrs sleep, 2 practice tests
new_student = [[5, 7, 2]]
prediction = clf.predict(new_student)

print("🎯 Prediction result (1=Pass, 0=Fail):", prediction[0])
if prediction[0] == 1:
    print("🏆 High probability of passing! Locked in fr fr!")`,
                explanation: "<strong>📊 10-Line ML Classifier:</strong> Uses a Decision Tree algorithm from `scikit-learn`. Trains on student study data to predict whether a future student will pass an upcoming exam!"
            }
        };
    }

    initCanvas() {
        this.canvas = document.getElementById('nnCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        // Define Node Network Geometry
        this.layers = [
            { name: "Input", count: 3, labels: ["Study Hrs", "Sleep", "Quizzes"], x: 80 },
            { name: "Hidden", count: 4, labels: ["H1", "H2", "H3", "H4"], x: 300 },
            { name: "Output", count: 1, labels: ["Exam Score"], x: 520 }
        ];

        this.calculateNodePositions();
        this.drawNetwork();
    }

    calculateNodePositions() {
        const height = this.canvas.height;
        this.nodes = [];

        this.layers.forEach((layer, lIndex) => {
            const spacing = height / (layer.count + 1);
            for (let nIndex = 0; nIndex < layer.count; nIndex++) {
                this.nodes.push({
                    layerIndex: lIndex,
                    nodeIndex: nIndex,
                    x: layer.x,
                    y: spacing * (nIndex + 1),
                    label: layer.labels[nIndex],
                    value: Math.random().toFixed(2)
                });
            }
        });
    }

    drawNetwork() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Connection Lines (Weights)
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = 0; j < this.nodes.length; j++) {
                const nodeA = this.nodes[i];
                const nodeB = this.nodes[j];
                if (nodeB.layerIndex === nodeA.layerIndex + 1) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(nodeA.x, nodeA.y);
                    this.ctx.lineTo(nodeB.x, nodeB.y);
                    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
                    this.ctx.lineWidth = 1.5;
                    this.ctx.stroke();
                }
            }
        }

        // Draw Pulses moving along weights
        this.pulses.forEach((pulse, idx) => {
            const startNode = this.nodes[pulse.fromIndex];
            const endNode = this.nodes[pulse.toIndex];
            const currentX = startNode.x + (endNode.x - startNode.x) * pulse.progress;
            const currentY = startNode.y + (endNode.y - startNode.y) * pulse.progress;

            this.ctx.beginPath();
            this.ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = '#00f0ff';
            this.ctx.shadowColor = '#00f0ff';
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            pulse.progress += 0.03;
            if (pulse.progress >= 1) {
                this.pulses.splice(idx, 1);
            }
        });

        // Draw Nodes
        this.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);
            
            if (node.layerIndex === 0) {
                this.ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
                this.ctx.strokeStyle = '#3b82f6';
            } else if (node.layerIndex === 1) {
                this.ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
                this.ctx.strokeStyle = '#8b5cf6';
            } else {
                this.ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
                this.ctx.strokeStyle = '#00f0ff';
            }
            this.ctx.lineWidth = 2;
            this.ctx.fill();
            this.ctx.stroke();

            // Label text above node
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '10px "Plus Jakarta Sans"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.label, node.x, node.y - 22);
        });

        if (this.animating) {
            requestAnimationFrame(() => this.drawNetwork());
        }
    }

    pulseNetwork() {
        this.pulses = [];
        // Generate pulses from Layer 0 -> Layer 1
        this.nodes.filter(n => n.layerIndex === 0).forEach(n0 => {
            const idx0 = this.nodes.indexOf(n0);
            this.nodes.filter(n => n.layerIndex === 1).forEach(n1 => {
                const idx1 = this.nodes.indexOf(n1);
                this.pulses.push({ fromIndex: idx0, toIndex: idx1, progress: 0 });
            });
        });

        // Generate pulses from Layer 1 -> Layer 2 with slight delay
        setTimeout(() => {
            this.nodes.filter(n => n.layerIndex === 1).forEach(n1 => {
                const idx1 = this.nodes.indexOf(n1);
                this.nodes.filter(n => n.layerIndex === 2).forEach(n2 => {
                    const idx2 = this.nodes.indexOf(n2);
                    this.pulses.push({ fromIndex: idx1, toIndex: idx2, progress: 0 });
                });
            });
        }, 400);

        this.animating = true;
        this.drawNetwork();
        
        // Randomize Epoch Loss display to mimic learning
        const lossEl = document.getElementById('valLoss');
        if (lossEl) {
            const newLoss = (Math.random() * 0.05 + 0.01).toFixed(4);
            lossEl.textContent = `${newLoss} (Decreasing 🚀)`;
        }

        if (window.gamification) {
            window.gamification.addXp(15, "ML Forward Pass Pulse");
        }
    }

    loadRecipe(recipeKey) {
        const recipe = this.recipes[recipeKey];
        if (!recipe) return;

        const titleEl = document.getElementById('recipeTitle');
        const codeEl = document.getElementById('recipeCode');
        const expEl = document.getElementById('recipeExplanation');

        if (titleEl) titleEl.textContent = recipe.title;
        if (codeEl) codeEl.textContent = recipe.code;
        if (expEl) expEl.innerHTML = recipe.explanation;

        // Highlight active button
        document.querySelectorAll('.recipe-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.recipe === recipeKey);
        });
    }
}

window.mlLabManager = new MLLabManager();
