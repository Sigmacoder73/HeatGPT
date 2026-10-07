/* ==========================================================================
   NOVA AI - GENERAL PURPOSE CHATGPT RESPONSE ENGINE
   ========================================================================== */

class AIEngine {
    constructor() {
        this.apiKey = localStorage.getItem('nova_gemini_api_key') || '';
        this.slangLevel = 'balanced';
    }

    setApiKey(key) {
        this.apiKey = key.trim();
        localStorage.setItem('nova_gemini_api_key', this.apiKey);
    }

    getApiKey() {
        return this.apiKey;
    }

    setSlangLevel(level) {
        this.slangLevel = level;
    }

    async generateResponse(userMessage, currentSubject = 'all') {
        if (this.apiKey) {
            try {
                return await this.callGeminiApi(userMessage, currentSubject);
            } catch (err) {
                console.warn("Gemini API call failed, falling back to local general AI engine:", err);
            }
        }

        return this.generateSmartLocalResponse(userMessage, currentSubject);
    }

    async callGeminiApi(userPrompt, subject) {
        const systemPrompt = `You are NOVA, a versatile, articulate, highly capable general-purpose AI assistant designed in the exact style of ChatGPT.

Guidelines:
1. **Direct, Comprehensive Answer**: Start with a direct, clear answer in the opening paragraph.
2. **Structured Formatting**: Use clean subheadings (###), bold key terms, numbered steps, bullet points, LaTeX math expressions ($...$ or $$...$$), and code blocks (\`\`\`language ... \`\`\`) where appropriate.
3. **Versatility**: You can write code, analyze data, draft emails/essays, troubleshoot errors, explain complex concepts, brainstorm creative ideas, and discuss any topic.
4. **Tone**: Clear, helpful, articulate, professional yet approachable. Avoid robotic filler phrases, forced routine templates, or excessive slang.`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
        
        const payload = {
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { text: `User prompt: ${userPrompt}` }
                ]
            }]
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty Gemini response");

        return text;
    }

    // --- General-Purpose ChatGPT Local Engine ---
    generateSmartLocalResponse(prompt, subject) {
        const p = prompt.toLowerCase().trim();

        // 1. Python, Coding & Software Engineering
        if (p.includes('python') || p.includes('code') || p.includes('script') || p.includes('scrape') || p.includes('function') || p.includes('api') || p.includes('bot') || p.includes('html') || p.includes('css') || p.includes('js') || p.includes('react')) {
            if (p.includes('scrape') || p.includes('news') || p.includes('web')) {
                return `Here is a complete, production-ready Python script for web scraping news headlines using \`requests\` and \`BeautifulSoup\`.

### Python Web Scraper Code

\`\`\`python
import requests
from bs4 import BeautifulSoup

def scrape_headlines(url="https://news.ycombinator.com/"):
    """
    Fetches and parses top news headlines from a website.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() # Raise error for bad HTTP status
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Select title elements
        titles = soup.select(".titleline > a")
        
        print(f"🔥 Top {min(10, len(titles))} Headlines:\n")
        for i, title in enumerate(titles[:10], 1):
            print(f"{i}. {title.text}")
            print(f"   Link: {title['href']}\n")
            
    except requests.RequestException as e:
        print(f"❌ Error scraping website: {e}")

if __name__ == "__main__":
    scrape_headlines()
\`\`\`

### How It Works Under the Hood

1. **HTTP GET Request:** \`requests.get()\` retrieves the raw HTML page from the web server.
2. **DOM Parsing:** \`BeautifulSoup(html, "html.parser")\` builds a navigable Document Object Model tree.
3. **CSS Selectors:** \`soup.select(".titleline > a")\` extracts matching elements based on CSS classes.

> 💡 **Best Practice:** Always check a website's \`robots.txt\` file and set custom User-Agent headers to ensure respectful scraping behavior.`;
            }

            return `Here is a structured overview of writing clean, maintainable Python code for your task:

### Key Programming Principles

1. **Modularity & Reusability:** Break functions down into single-responsibility components.
2. **Error Handling:** Wrap external network or file operations in \`try-except\` blocks to ensure resilience.
3. **Type Hinting & Docstrings:** Document input parameters and return types clearly.

\`\`\`python
from typing import List, Dict

def process_data(items: List[int]) -> Dict[str, float]:
    """Computes basic statistics for a list of numeric items."""
    if not items:
        return {"mean": 0.0, "max": 0.0}
        
    return {
        "mean": sum(items) / len(items),
        "max": float(max(items)),
        "count": len(items)
    }

# Example Usage
stats = process_data([10, 20, 30, 40, 50])
print("Stats Output:", stats)
\`\`\`

> 💡 **Tip:** Need help debugging a specific error or writing a script? Paste your code snippet here and I'll analyze it!`;
        }

        // 2. Machine Learning, AI & Data Science
        if (p.includes('neural') || p.includes('ml') || p.includes('machine learning') || p.includes('ai') || p.includes('model') || p.includes('train') || p.includes('transformer') || p.includes('llm')) {
            return `A **Neural Network** is a machine learning model designed to learn complex non-linear mappings between input features ($X$) and target outcomes ($y$).

### Architectural Overview

1. **Input Layer:** Accepts numeric feature vectors (e.g. image pixels, text tokens, tabular metrics).
2. **Hidden Layers:** Transforms inputs using weighted linear combinations followed by non-linear activation functions:
   $$z = \\text{ReLU}(W \\cdot X + b)$$
3. **Output Layer:** Produces final classification probabilities or continuous regression values.

### The Training Cycle

\`\`\`
[Input X] ──> (Forward Pass) ──> [Prediction] ──> [Loss Computation]
                                                         │
[Updated W] <── (Gradient Descent) <── (Backpropagation) ┘
\`\`\`

* **Forward Pass:** Data flows through the network to generate predictions.
* **Loss Function:** Measures discrepancy between prediction and actual target value (e.g., Mean Squared Error or Cross-Entropy).
* **Backpropagation:** Computes output loss gradients relative to every weight using the **Chain Rule**.
* **Gradient Descent:** Adjusts weight values to minimize total loss:
  $$W_{\\text{new}} = W_{\\text{old}} - \\eta \\cdot \\nabla L$$

> 💡 **Summary:** Modern Deep Learning models (like Transformers and LLMs) use multi-layer attention networks trained on massive datasets to generate natural language, images, and code.`;
        }

        // 3. Writing, Emails, Scripts & Creative Brainstorming
        if (p.includes('email') || p.includes('write') || p.includes('draft') || p.includes('script') || p.includes('youtube') || p.includes('outline') || p.includes('essay')) {
            if (p.includes('email')) {
                return `Here is a professional, polite email draft template you can customize for your needs:

***

**Subject:** Meeting Request: [Topic/Project Name] – [Your Name]

Hi [Recipient's Name],

I hope this email finds you well. 

I am reaching out to discuss **[Topic/Project Name]**. I would love to schedule a brief 15–20 minute call to align on [Key Goal 1] and review [Key Goal 2].

Here are a few times I am available this week:
* **Option 1:** [Day, Date] at [Time, e.g. 10:00 AM]
* **Option 2:** [Day, Date] at [Time, e.g. 2:00 PM]

Please let me know if any of these times work for you, or feel free to suggest an alternative.

Best regards,

**[Your Name]**  
[Your Title/Role]  
[Your Contact Information]

***

> 💡 **Tip:** If you need to tailor this email for a specific scenario (e.g., job application, project update, client pitch), let me know and I'll customize it for you!`;
            }

            return `Here is a structured breakdown for outlining and drafting high-impact content:

### 🎬 Content Outline Strategy

1. **The Hook (First 5–10 Seconds):** State a compelling problem, bold statement, or intriguing question to capture immediate attention.
2. **The Core Problem:** Define why this topic matters and what challenges it solves for the audience.
3. **Step-by-Step Breakdown:** Deliver main points logically in 3 distinct, actionable sections.
4. **Call to Action (CTA):** End with a clear next step (e.g. subscribe, check links, leave a comment).

> 💡 **Next Steps:** Tell me what specific topic you're writing about, and I'll draft the complete script or article for you!`;
        }

        // 4. Mathematics & Astronomy / Science
        if (p.includes('mars') || p.includes('gravity') || p.includes('math') || p.includes('algebra') || p.includes('physics') || p.includes('quantum') || p.includes('science')) {
            return `Gravity on Mars is approximately **38% of Earth's gravity** ($3.71 \\text{ m/s}^2$ compared to Earth's $9.81 \\text{ m/s}^2$). An individual weighing 100 pounds on Earth would weigh only 38 pounds on Mars!

### Gravitational Physics Formula

Surface gravity is governed by Newton's Law of Universal Gravitation:

$$F = G \\frac{m_1 m_2}{r^2}$$

* **Mass Effect:** Mars has approximately $11\\%$ of Earth's total mass.
* **Radius Effect:** Mars has a smaller radius ($3,389 \\text{ km}$ vs. Earth's $6,371 \\text{ km}$), which slightly increases surface gravity relative to its small mass.

### Key Implications

1. **Space Exploration:** Rockets launching off Mars require substantially less delta-V (thrust energy) to escape orbit compared to Earth launches.
2. **Atmospheric Erosion:** Weaker gravity contributed to Mars losing most of its atmosphere over billions of years after its core cooled and magnetic field faded.

> 💡 **Key Takeaway:** Lower mass leads to lower surface gravity, presenting unique mechanical advantages and human biological challenges for interplanetary colonization.`;
        }

        // 5. Versatile General Query Response Engine
        const cleanTitle = prompt.charAt(0).toUpperCase() + prompt.slice(1);
        return `### Comprehensive Overview of ${cleanTitle}

**${cleanTitle}** can be understood through its core principles, internal mechanics, and practical applications.

### Key Principles & Framework

1. **Core Concept:**
   At a fundamental level, **${cleanTitle}** relies on structured logical rules and input-output relationships.

2. **System Breakdown:**
   * **Input Phase:** Defining the initial parameters, data, or context.
   * **Processing Phase:** Executing transformations, calculations, or logic.
   * **Output Phase:** Generating actionable results, predictions, or creative deliverables.

3. **Practical Implementation:**
   Whether working on code, writing, or scientific analysis, breaking complex tasks into smaller modular steps leads to optimal results.

> 💡 **How can I assist further?** Let me know if you'd like code examples, a detailed essay/script draft, or a step-by-step technical breakdown on **${cleanTitle}**!`;
    }
}

window.aiEngine = new AIEngine();
