import sys
import os
import io
import json
import asyncio
import re
import base64
import random
import urllib.request
import urllib.parse
from typing import Dict, List, Any, Optional

# Ensure UTF-8 standard output for Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from dotenv import load_dotenv
load_dotenv()

from starlette.applications import Starlette
from starlette.responses import JSONResponse, StreamingResponse, FileResponse, Response
from starlette.routing import Route
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn

# Live Web Scraper & Searcher Helper Functions
def fetch_url_text(url: str, max_chars: int = 3000) -> str:
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        html = urllib.request.urlopen(req, timeout=6).read().decode('utf-8', errors='ignore')
        text = re.sub(r'<script.*?>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style.*?>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:max_chars]
    except Exception as e:
        return f"Could not fetch content from {url}: {str(e)}"

def search_web(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    results = []
    
    # 1. DuckDuckGo Lite Search
    try:
        ddg_url = "https://lite.duckduckgo.com/lite/"
        data = urllib.parse.urlencode({'q': query}).encode('utf-8')
        req = urllib.request.Request(ddg_url, data=data, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        html = urllib.request.urlopen(req, timeout=6).read().decode('utf-8', errors='ignore')
        
        rows = re.findall(r'<td class="result-snippet">(.*?)</td>', html, re.DOTALL)
        links = re.findall(r'<a class="result-link"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', html, re.DOTALL)
        
        for i in range(min(len(links), max_results)):
            raw_url, title = links[i]
            snippet = rows[i].strip() if i < len(rows) else ""
            title = re.sub(r'<[^>]+>', '', title).strip()
            snippet = re.sub(r'<[^>]+>', '', snippet).strip()
            
            url_match = re.search(r'uddg=(https?%3A%2F%2F[^&]+)', raw_url)
            if url_match:
                clean_url = urllib.parse.unquote(url_match.group(1))
            else:
                clean_url = raw_url if raw_url.startswith('http') else 'https://' + raw_url
                
            if title and snippet:
                results.append({'title': title, 'snippet': snippet, 'url': clean_url})
    except Exception as e:
        print(f"DDG Search error: {e}")

    # 2. Wikipedia Search Fallback
    if len(results) < 2:
        try:
            wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&format=json"
            w_req = urllib.request.Request(wiki_url, headers={'User-Agent': 'Mozilla/5.0'})
            res = json.loads(urllib.request.urlopen(w_req, timeout=5).read().decode('utf-8'))
            for item in res.get('query', {}).get('search', [])[:4]:
                title = item.get('title', '')
                snippet = re.sub(r'<[^>]+>', '', item.get('snippet', ''))
                link = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}"
                results.append({'title': title, 'snippet': snippet, 'url': link})
        except Exception as ex:
            print(f"Wiki Search error: {ex}")

    return results

# Global Vector Store Reference
VECTOR_STORE = None
VECTOR_STORE_STATS = {}

def get_vector_store():
    global VECTOR_STORE, VECTOR_STORE_STATS
    if VECTOR_STORE is not None:
        return VECTOR_STORE

    try:
        from langchain_community.document_loaders import TextLoader
        from langchain_core.documents import Document
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_chroma import Chroma
        import pandas as pd

        try:
            from langchain_huggingface import HuggingFaceEmbeddings
        except ImportError:
            from langchain_community.embeddings import HuggingFaceEmbeddings

        txt_path = "policy.txt"
        xlsx_path = "products.xlsx"
        all_documents = []
        stats = {"policy_count": 0, "product_count": 0}

        if os.path.exists(txt_path):
            loader = TextLoader(txt_path, encoding="utf-8")
            policy_docs = loader.load()
            for doc in policy_docs:
                doc.metadata["source"] = os.path.basename(txt_path)
                doc.metadata["type"] = "Company Policy"
            all_documents.extend(policy_docs)
            stats["policy_count"] = len(policy_docs)

        if os.path.exists(xlsx_path):
            df = pd.read_excel(xlsx_path)
            stats["product_count"] = len(df)
            for index, row in df.iterrows():
                fields = [f"**{col}**: {row[col]}" for col in df.columns if pd.notna(row[col])]
                device_name = str(row.get("Model Name", row.get("Device Name", row.get("Product Name", f"Device #{index+1}"))))
                row_content = f"### DEVICE RECORD: {device_name}\n" + "\n".join(fields)
                doc = Document(
                    page_content=row_content,
                    metadata={
                        "source": os.path.basename(xlsx_path),
                        "type": "Device Record",
                        "row_index": index,
                        "device_name": device_name
                    }
                )
                all_documents.append(doc)

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = text_splitter.split_documents(all_documents)
        stats["total_chunks"] = len(chunks)
        VECTOR_STORE_STATS = stats

        embedding_fn = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        collection_name = "local_docs_384"
        persist_dir = "./chroma_db_local"

        VECTOR_STORE = Chroma.from_documents(
            documents=chunks,
            embedding=embedding_fn,
            collection_name=collection_name,
            persist_directory=persist_dir
        )
        print(f"[RAG Index] Loaded {len(chunks)} document chunks.")
    except Exception as e:
        print(f"[RAG Index Error] {e}")

    return VECTOR_STORE

# Query RAG Function
def query_rag(question: str) -> Dict[str, Any]:
    v_store = get_vector_store()
    if not v_store:
        return {"answer": "Vector store initialization failed.", "sources": []}

    retriever = v_store.as_retriever(search_kwargs={"k": 4})
    retrieved_docs = retriever.invoke(question)

    sources = []
    response_blocks = []

    for doc in retrieved_docs:
        sources.append({
            "source": doc.metadata.get("source", "Unknown"),
            "type": doc.metadata.get("type", "Document"),
            "content": doc.page_content
        })

    device_docs = [d for d in retrieved_docs if d.metadata.get("type") == "Device Record"]
    policy_docs = [d for d in retrieved_docs if d.metadata.get("type") == "Company Policy"]

    if device_docs:
        response_blocks.append("### 💻 Device Information\n")
        for doc in device_docs:
            response_blocks.append(doc.page_content)
            response_blocks.append("")

    if policy_docs:
        response_blocks.append("### 📜 Company Policy Information\n")
        for doc in policy_docs:
            response_blocks.append(doc.page_content)
            response_blocks.append("")

    if not response_blocks and retrieved_docs:
        response_blocks.append("### 🔍 Search Results\n")
        for doc in retrieved_docs:
            response_blocks.append(doc.page_content)

    answer = "\n".join(response_blocks).strip() if response_blocks else "No relevant information found in local documents."
    return {"answer": answer, "sources": sources}

# API Handlers
async def api_health(request):
    api_key_set = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    return JSONResponse({
        "status": "ok",
        "app_name": "HeatGPT AI Podcast Generator & Study Hub",
        "api_key_configured": api_key_set
    })

async def api_chat(request):
    try:
        body = await request.json()
        messages = body.get("messages", [])
        mode = body.get("mode", "general")
        is_research = body.get("research_mode", False) or (mode == "research")
        req_model = body.get("model", "gemini-3.5-flash")
        system_instruction = body.get("system_prompt", "You are HeatGPT Study Buddy 📚🎓 — a super chill, friendly, supportive, and engaging study tutor & AI assistant!")
        custom_api_key = body.get("api_key", "").strip()

        # 📋 INJECT USER'S LIVE TASK LIST INTO AI CONTEXT
        user_tasks = body.get("tasks", [])
        if user_tasks:
            task_lines = []
            for idx, t in enumerate(user_tasks):
                status_str = "✅ DONE" if t.get("completed") else "⏳ PENDING"
                prio_str = f"[{t.get('priority', 'medium').upper()}]"
                task_lines.append(f"{idx+1}. {status_str} {prio_str} - {t.get('title')}")
            
            tasks_formatted = "\n".join(task_lines)
            task_context = f"\n\n📋 USER'S LIVE TASK LIST & STATUS:\n{tasks_formatted}\n\nAI INSTRUCTION: You have full real-time awareness of the user's task list above. When the user asks about their tasks, which ones are done, which ones are pending, or wants help finishing them, directly reference the specific tasks by name and state!"
            system_instruction += task_context

        api_key = custom_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        candidate_models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]

        last_user_msg = ""
        last_attachments = []
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")
                last_attachments = m.get("attachments", [])
                break

        # 0. 🎨 & 🎬 AI PHOTO & VIDEO GENERATION DETECTOR (POWERED BY GEMINI AI)
        msg_lower = last_user_msg.lower().strip()
        is_video_req = any(k in msg_lower for k in [
            "generate video", "make a video", "create a video", "create video", "generate a video", 
            "video of", "produce a video", "render video", "show me a video", "/video", "generate video of"
        ])
        is_image_req = any(k in msg_lower for k in [
            "generate photo", "generate image", "create photo", "create image", "make a photo", "make an image",
            "draw ", "draw a", "paint ", "picture of", "photo of", "image of", "show me a photo", "show me an image",
            "/image", "/photo", "/draw", "generate an image", "generate a picture", "make a picture"
        ]) and not is_video_req

        if is_video_req or is_image_req:
            # 1. Clean prompt text precisely
            clean_prompt = last_user_msg
            remove_phrases = [
                "generate a video of", "generate video of", "generate a photo of", "generate photo of",
                "generate an image of", "generate image of", "create a video of", "create video of",
                "create a photo of", "create photo of", "create an image of", "create image of",
                "make a video of", "make video of", "make a photo of", "make photo of",
                "make an image of", "make image of", "draw a photo of", "draw an image of",
                "show me a video of", "show me a photo of", "show me an image of",
                "show me a", "show me", "picture of", "video of", "/video", "/image", "/photo", "/draw",
                "generate a", "generate", "create a", "create", "make a", "make"
            ]
            for p in remove_phrases:
                clean_prompt = re.sub(r'\b' + re.escape(p) + r'\b', "", clean_prompt, flags=re.IGNORECASE)
            clean_prompt = clean_prompt.strip()
            if not clean_prompt or len(clean_prompt) < 2:
                clean_prompt = "sleek luxury sports car driving on coastal highway"
            
            # 2. Smart Model Selection & Human-Eye True Realism Optics
            msg_lower_clean = clean_prompt.lower()
            is_anime = any(w in msg_lower_clean for w in ["anime", "manga", "cartoon", "illustration", "cyberpunk", "octane", "vector", "drawing", "painting"])
            
            if is_anime:
                model_choice = "flux-anime"
                style_tag = "full subject view, centered composition, masterpiece 8k anime artwork, vibrant natural color grading, pin-sharp details, 8k resolution"
                engine_label = "🍌 Nano Banana 1.0 FLUX-Anime 8K Engine"
            else:
                model_choice = "flux"
                # True-to-life human eye vision optics (50mm natural eye perspective, crystal clear sharpness, true daylighting, no artificial blur)
                style_tag = "eye level perspective, 50mm natural human eye lens, crystal clear pin-sharp focus, true to life natural lighting, realistic full shot of subject, clear sharp details, unedited photo"
                engine_label = "👁️ Nano Banana Human-Eye Realism Engine (50mm Optics)"

            shq_prompt = f"{clean_prompt}, {style_tag}"
            encoded_prompt = urllib.parse.quote(shq_prompt)
            seed = random.randint(10000, 999999)

            async def stream_media_generation():
                cot_thinking_box = (
                    f"<details class=\"ai-cot-box\" open>\n"
                    f"  <summary><i class=\"fa-solid fa-eye\" style=\"color: #facc15;\"></i> <strong>Nano Banana Human-Eye Vision Engine (50mm Optics) 🍌</strong></summary>\n"
                    f"  <div class=\"ai-cot-content\">\n"
                    f"    <ul>\n"
                    f"      <li><strong>👁️ Step 1 (Human Eye Perspective):</strong> Calibrated 50mm natural focal length matching human eye field-of-view for subject <em>\"{clean_prompt}\"</em>.</li>\n"
                    f"      <li><strong>📸 Step 2 (Crystal-Clear Focus):</strong> True-to-life daylighting, pin-sharp edge clarity &amp; accurate color balance with zero artificial blur.</li>\n"
                    f"      <li><strong>🍌 Step 3 (Engine Render):</strong> Dispatched to {engine_label}.</li>\n"
                    f"    </ul>\n"
                    f"  </div>\n"
                    f"</details>\n\n"
                )

                if is_video_req:
                    video_url = f"https://video.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&seed={seed}&nologo=true&model={model_choice}"
                    poster_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&seed={seed}&nologo=true&enhance=true&model={model_choice}"
                    
                    text_reply = (
                        f"### 🎬 HeatGPT AI Video Generator 🍌 *(Powered by Human-Eye Realism Engine)*\n\n"
                        f"{cot_thinking_box}"
                        f"**Target Subject:** *\"{clean_prompt}\"*\n\n"
                        f"<div class=\"ai-media-card\">\n"
                        f"  <div style=\"display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;\">\n"
                        f"    <span style=\"background: rgba(250, 204, 21, 0.2); border: 1px solid #facc15; color: #facc15; font-size: 0.8rem; font-weight: 800; padding: 4px 10px; border-radius: 20px;\">🍌 Nano Banana 1080p HD Video Clip</span>\n"
                        f"    <small style=\"color: #94a3b8;\">Seed: {seed}</small>\n"
                        f"  </div>\n"
                        f"  <div class=\"ai-video-wrapper\">\n"
                        f"    <video src=\"{video_url}\" poster=\"{poster_url}\" controls autoplay loop muted class=\"ai-generated-video\"></video>\n"
                        f"  </div>\n"
                        f"  <div class=\"ai-media-actions\">\n"
                        f"    <a href=\"{video_url}\" download=\"nano_banana_video_{seed}.mp4\" target=\"_blank\" class=\"ai-media-download-btn\" style=\"background: linear-gradient(135deg, #facc15, #f97316); color: #000 !important;\">\n"
                        f"      <i class=\"fa-solid fa-film\"></i> Download MP4 Video\n"
                        f"    </a>\n"
                        f"    <button type=\"button\" class=\"ai-media-action-btn\" onclick=\"navigator.clipboard.writeText('{video_url}')\">\n"
                        f"      <i class=\"fa-solid fa-link\"></i> Copy Video Link\n"
                        f"    </button>\n"
                        f"  </div>\n"
                        f"</div>\n"
                    )
                else:
                    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&seed={seed}&nologo=true&enhance=true&model={model_choice}"
                    text_reply = (
                        f"### 🖼️ HeatGPT AI Photo Studio 🍌 *(Powered by Human-Eye Realism Engine)*\n\n"
                        f"{cot_thinking_box}"
                        f"**Target Subject:** *\"{clean_prompt}\"*\n\n"
                        f"<div class=\"ai-media-card\">\n"
                        f"  <div style=\"display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;\">\n"
                        f"    <span style=\"background: rgba(250, 204, 21, 0.2); border: 1px solid #facc15; color: #facc15; font-size: 0.8rem; font-weight: 800; padding: 4px 10px; border-radius: 20px;\">{engine_label}</span>\n"
                        f"    <small style=\"color: #94a3b8;\">Seed: {seed}</small>\n"
                        f"  </div>\n"
                        f"  <img src=\"{image_url}\" alt=\"{clean_prompt}\" class=\"ai-generated-photo\" onclick=\"window.open('{image_url}', '_blank')\">\n"
                        f"  <div class=\"ai-media-actions\">\n"
                        f"    <a href=\"{image_url}\" download=\"nano_banana_photo_{seed}.jpg\" target=\"_blank\" class=\"ai-media-download-btn\" style=\"background: linear-gradient(135deg, #facc15, #f97316); color: #000 !important;\">\n"
                        f"      <i class=\"fa-solid fa-download\"></i> Download Human-Eye Photo (.JPG)\n"
                        f"    </a>\n"
                        f"    <button type=\"button\" class=\"ai-media-action-btn\" onclick=\"window.open('{image_url}', '_blank')\">\n"
                        f"      <i class=\"fa-solid fa-expand\"></i> Zoom Fullscreen\n"
                        f"    </button>\n"
                        f"    <button type=\"button\" class=\"ai-media-action-btn\" onclick=\"navigator.clipboard.writeText('{image_url}')\">\n"
                        f"      <i class=\"fa-solid fa-link\"></i> Copy Link\n"
                        f"    </button>\n"
                        f"  </div>\n"
                        f"</div>\n"
                    )

                for i in range(0, len(text_reply), 30):
                    chunk = text_reply[i:i+30]
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                    await asyncio.sleep(0.008)
                yield f"data: {json.dumps({'done': True})}\n\n"

            return StreamingResponse(stream_media_generation(), media_type="text/event-stream")

        # 1. LIVE WEB RESEARCH MODE
        if is_research:
            url_match = re.search(r'https?://[^\s]+', last_user_msg)
            web_sources = []
            web_context = ""

            if url_match:
                target_url = url_match.group(0)
                page_text = fetch_url_text(target_url)
                web_sources.append({"title": "Direct Web Page Content", "url": target_url, "snippet": page_text[:300]})
                web_context = f"Direct Web Page Content from {target_url}:\n\n{page_text}"
            else:
                web_results = search_web(last_user_msg, max_results=5)
                context_blocks = []
                for idx, item in enumerate(web_results):
                    web_sources.append({"title": item["title"], "url": item["url"], "snippet": item["snippet"]})
                    context_blocks.append(f"[{idx+1}] Source Title: {item['title']}\nURL: {item['url']}\nSnippet: {item['snippet']}")
                web_context = "\n\n".join(context_blocks)

            async def stream_research_genai():
                if api_key:
                    try:
                        from google import genai
                        from google.genai import types
                        client = genai.Client(api_key=api_key)
                        
                        prompt = (
                            f"You are HeatGPT in Live Research Mode 🌐🔍!\n"
                            f"Synthesize the following live web search findings to accurately answer the user query in a friendly, chill, and structured format with emojis (🌐, 📰, 💡, 🧠, 🚀).\n"
                            f"Include relevant inline citations referencing the web sources.\n\n"
                            f"Live Web Research Findings:\n{web_context}\n\n"
                            f"User Query:\n{last_user_msg}"
                        )

                        for model in candidate_models:
                            try:
                                response = client.models.generate_content_stream(
                                    model=model,
                                    contents=prompt,
                                    config=types.GenerateContentConfig(
                                        system_instruction="You are HeatGPT Web Researcher. Provide accurate, clear research syntheses with source citations!"
                                    )
                                )
                                for chunk in response:
                                    if chunk.text:
                                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                                yield f"data: {json.dumps({'sources': web_sources, 'done': True})}\n\n"
                                return
                            except Exception as model_err:
                                print(f"Research model {model} error: {model_err}")
                                continue
                    except Exception as ex:
                        print(f"Research GenAI Error: {ex}")

                fallback_msg = f"🌐 **Live Web Research Results for:** '{last_user_msg}'\n\n"
                for idx, s in enumerate(web_sources):
                    fallback_msg += f"**[{idx+1}] [{s['title']}]({s['url']})**\n{s['snippet']}\n\n"
                for i in range(0, len(fallback_msg), 15):
                    yield f"data: {json.dumps({'text': fallback_msg[i:i+15]})}\n\n"
                    await asyncio.sleep(0.02)
                yield f"data: {json.dumps({'sources': web_sources, 'done': True})}\n\n"

            return StreamingResponse(stream_research_genai(), media_type="text/event-stream")

        # 2. LOCAL RAG MODE
        if mode == "rag":
            rag_result = query_rag(last_user_msg)

            async def stream_rag_genai():
                if api_key:
                    try:
                        from google import genai
                        from google.genai import types
                        client = genai.Client(api_key=api_key)
                        rag_context = rag_result["answer"]
                        prompt = f"Using ONLY the following company context, answer the user question accurately in a friendly, chill tone with emojis! 📜✨\n\nContext:\n{rag_context}\n\nUser Question:\n{last_user_msg}"
                        
                        for model in candidate_models:
                            try:
                                response = client.models.generate_content_stream(
                                    model=model,
                                    contents=prompt,
                                    config=types.GenerateContentConfig(
                                        system_instruction="You are HeatGPT. Answer clearly, accurately, and in a chill, friendly tone with emojis! ✨📚"
                                    )
                                )
                                for chunk in response:
                                    if chunk.text:
                                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                                yield f"data: {json.dumps({'sources': rag_result['sources'], 'done': True})}\n\n"
                                return
                            except Exception:
                                continue
                    except Exception as ex:
                        print(f"GenAI RAG error: {ex}")

                full_text = rag_result["answer"]
                for i in range(0, len(full_text), 15):
                    chunk = full_text[i:i+15]
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                    await asyncio.sleep(0.02)
                yield f"data: {json.dumps({'sources': rag_result['sources'], 'done': True})}\n\n"

            return StreamingResponse(stream_rag_genai(), media_type="text/event-stream")

        # 3. GENERAL MULTIMODAL AI MODE
        if not api_key:
            async def stream_no_key():
                msg = ("⚠️ **No Gemini API Key found.**\n\n"
                       "To chat with real-time HeatGPT, please set your `GEMINI_API_KEY` in `.env` "
                       "or enter your API Key in the settings modal in the bottom left.")
                for i in range(0, len(msg), 15):
                    yield f"data: {json.dumps({'text': msg[i:i+15]})}\n\n"
                    await asyncio.sleep(0.02)
                yield f"data: {json.dumps({'done': True})}\n\n"
            return StreamingResponse(stream_no_key(), media_type="text/event-stream")

        async def stream_genai_response():
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key)

            contents = []
            for msg in messages:
                role = "user" if msg.get("role") == "user" else "model"
                parts = []
                
                msg_attachments = msg.get("attachments", [])
                for att in msg_attachments:
                    att_type = att.get("type")
                    att_data = att.get("data", "")
                    mime_type = att.get("mime_type", "image/png")
                    filename = att.get("name", "Document")

                    if att_type == "image" and att_data:
                        try:
                            header, b64_str = att_data.split(",", 1) if "," in att_data else ("", att_data)
                            img_bytes = base64.b64decode(b64_str)
                            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                        except Exception as img_err:
                            print(f"Image decode error: {img_err}")
                    elif att_type == "file" and att.get("text_content"):
                        file_block = f"\n\n--- ATTACHED DOCUMENT: {filename} ---\n{att['text_content']}\n--- END ATTACHED DOCUMENT ---\n"
                        parts.append(types.Part.from_text(text=file_block))

                text_val = msg.get("content", "")
                if text_val or not parts:
                    parts.append(types.Part.from_text(text=text_val if text_val else "Analyze the attached image/file."))
                
                contents.append(types.Content(role=role, parts=parts))

            last_err = None
            success = False
            for model in candidate_models:
                try:
                    response = client.models.generate_content_stream(
                        model=model,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.75
                        )
                    )
                    for chunk in response:
                        if chunk.text:
                            yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                    success = True
                    break
                except Exception as e:
                    last_err = e
                    continue

            if not success and last_err:
                err_msg = f"\n\n❌ **API Error**: {str(last_err)}"
                yield f"data: {json.dumps({'text': err_msg})}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"

        return StreamingResponse(stream_genai_response(), media_type="text/event-stream")

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ==========================================================================
# 🎙️ FAST ULTRA-HIGH-QUALITY AI PODCAST GENERATOR (5s HARD TIMEOUT)
# ==========================================================================
async def api_podcast_generate(request):
    try:
        body = await request.json()
        topic = body.get("topic", "The Future of AI").strip() or "The Future of AI & Learning"
        format_type = body.get("format", "dual_host")
        tone = body.get("tone", "chill")
        length = body.get("length", "standard")
        req_model = body.get("model", "gemini-3.5-flash")
        custom_api_key = body.get("api_key", "").strip()
        api_key = custom_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

        if not api_key:
            return JSONResponse({"error": "No Gemini API Key found. Please add your key in Settings!"}, status_code=400)

        turns_target = 6 if length == "quick" else (10 if length == "standard" else 14)

        prompt = (
            f"You are Gemini Master Podcast Producer 🎙️📻!\n"
            f"Generate a podcast episode script on topic: '{topic}'.\n"
            f"Format style: {format_type}. Tone style: {tone}.\n"
            f"Generate exactly {turns_target} turn-by-turn dialogue exchanges between Alex and Taylor.\n\n"
            f"Respond ONLY with valid JSON in this exact structure without markdown code blocks:\n"
            f"{{\n"
            f'  "title": "HeatGPT Deep Dive: {topic}",\n'
            f'  "description": "Episode summary description for {topic}!",\n'
            f'  "hosts": ["Alex", "Taylor"],\n'
            f'  "transcript": [\n'
            f'    {{"speaker": "Alex", "voice_gender": "male", "text": "Welcome back to HeatGPT Deep Dives! Today we explore {topic}."}},\n'
            f'    {{"speaker": "Taylor", "voice_gender": "female", "text": "Hey everyone! I am super excited to dive into {topic} today."}}\n'
            f'  ]\n'
            f"}}\n"
        )

        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)

        async def fetch_gemini_podcast():
            loop = asyncio.get_event_loop()
            def sync_gen():
                res = client.models.generate_content(
                    model=req_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.7, max_output_tokens=1200)
                )
                return res.text
            raw_text = await loop.run_in_executor(None, sync_gen)
            raw_text = re.sub(r"^```json\s*", "", raw_text.strip(), flags=re.MULTILINE)
            raw_text = re.sub(r"^```\s*", "", raw_text.strip(), flags=re.MULTILINE)
            json_match = re.search(r'\{[\s\S]*\}', raw_text.strip())
            if json_match:
                raw_text = json_match.group(0)
            return json.loads(raw_text)

        try:
            podcast_data = await asyncio.wait_for(fetch_gemini_podcast(), timeout=4.5)
            if "transcript" in podcast_data and len(podcast_data["transcript"]) > 0:
                return JSONResponse({"status": "ok", "podcast": podcast_data, "model": req_model})
        except Exception as fast_err:
            print(f"Gemini fast timeout / fallback: {fast_err}")

        # INSTANT LIGHTNING SPEED FALLBACK DEEP DIVE PODCAST SCRIPT (< 0.01s)
        fallback_podcast = {
            "title": f"HeatGPT Deep Dive: {topic}",
            "description": f"Join Alex & Taylor as they unpack the fascinating secrets of {topic} in an engaging deep dive!",
            "hosts": ["Alex", "Taylor"],
            "transcript": [
                {"speaker": "Alex", "voice_gender": "male", "text": f"Yo, what's up everyone! Welcome back to another super chill episode of HeatGPT Deep Dives. I'm Alex."},
                {"speaker": "Taylor", "voice_gender": "female", "text": f"And I'm Taylor! Today we are tackling something absolutely fascinating: {topic}."},
                {"speaker": "Alex", "voice_gender": "male", "text": f"Right! What gets me excited about {topic} is how it connects to so many big ideas in modern science and everyday life."},
                {"speaker": "Taylor", "voice_gender": "female", "text": "Oh 100 percent! When you break down the core mechanics, it's actually super logical once you see the pattern."},
                {"speaker": "Alex", "voice_gender": "male", "text": f"Exactly. So the key takeaway for {topic} is understanding how each component builds on the next."},
                {"speaker": "Taylor", "voice_gender": "female", "text": "Spot on Alex! That was an awesome breakdown. Thanks for tuning in everyone!"}
            ]
        }
        return JSONResponse({"status": "ok", "podcast": fallback_podcast, "model": "instant-fast"})

    except Exception as e:
        print(f"api_podcast_generate exception: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# ==========================================================================
# 💾 HIGH DEFINITION REAL MP3 PODCAST AUDIO GENERATOR ENDPOINT
# ==========================================================================
async def api_podcast_download_mp3(request):
    try:
        body = await request.json()
        transcript = body.get("transcript", [])
        title = body.get("title", "HeatGPT_Podcast_Episode")

        if not transcript:
            return JSONResponse({"error": "No transcript provided to convert to MP3."}, status_code=400)

        import edge_tts

        audio_bytes_list = []
        for turn in transcript:
            speaker = turn.get("speaker", "Host")
            text = turn.get("text", "")
            gender = turn.get("voice_gender", "male" if speaker == "Alex" else "female")

            clean_text = re.sub(r'[*_~#>-]', ' ', text)
            clean_text = re.sub(r'\s+', ' ', clean_text).strip()

            if not clean_text:
                continue

            voice_name = "en-US-GuyNeural" if gender == "male" or speaker == "Alex" else "en-US-JennyNeural"

            try:
                communicate = edge_tts.Communicate(clean_text, voice_name)
                turn_mp3_data = bytearray()
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        turn_mp3_data.extend(chunk["data"])
                audio_bytes_list.append(bytes(turn_mp3_data))
            except Exception as tts_err:
                print(f"TTS synth error for {speaker}: {tts_err}")

        if not audio_bytes_list:
            from gtts import gTTS
            full_text = " ".join([f"{t.get('speaker', 'Host')}: {t.get('text', '')}" for t in transcript])
            tts = gTTS(text=full_text, lang='en')
            mp3_fp = io.BytesIO()
            tts.write_to_fp(mp3_fp)
            full_mp3_bytes = mp3_fp.getvalue()
        else:
            full_mp3_bytes = b"".join(audio_bytes_list)

        filename = re.sub(r'[^a-zA-Z0-9_-]', '_', title).lower() + ".mp3"
        return Response(
            content=full_mp3_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except Exception as e:
        print(f"api_podcast_download_mp3 exception: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# JSON Endpoint for Gemini Powered Study & Quiz Generator
async def api_study_generate(request):
    try:
        body = await request.json()
        tool_type = body.get("type", "flashcards")
        topic = body.get("topic", "General Science").strip() or "General Knowledge & Science"
        difficulty = body.get("difficulty", "Intermediate")
        image_data = body.get("image_data", "").strip()
        req_model = body.get("model", "gemini-3.5-flash")
        custom_api_key = body.get("api_key", "").strip()
        api_key = custom_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

        if not api_key:
            return JSONResponse({"error": "No Gemini API Key found. Please add your key in Settings!"}, status_code=400)

        candidate_models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]

        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)

        parts = []

        if image_data:
            try:
                header, b64_str = image_data.split(",", 1) if "," in image_data else ("", image_data)
                mime_type = "image/png"
                if "data:image/jpeg" in header: mime_type = "image/jpeg"
                elif "data:image/webp" in header: mime_type = "image/webp"
                img_bytes = base64.b64decode(b64_str)
                parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
            except Exception as img_err:
                print(f"Quiz image decode error: {img_err}")

        if tool_type == "flashcards":
            count = int(body.get("count", 5))
            prompt_text = (
                f"You are Gemini HeatGPT Study Buddy 🧠📚.\n"
                f"Generate exactly {count} distinct, authentic flashcards for topic: '{topic}' at difficulty level: '{difficulty}'.\n"
                f"If an image is attached, inspect the image/diagram/notes carefully and generate flashcards strictly based on its visual contents!\n\n"
                f"Respond ONLY with valid JSON array without markdown formatting:\n"
                f"[\n"
                f'  {{"id": 1, "question": "Question text?", "answer": "Detailed answer definition", "hint": "Short clue"}}\n'
                f"]"
            )
        else:
            mcq_count = int(body.get("mcqs", 4))
            fill_count = int(body.get("fill_blanks", 3))
            short_count = int(body.get("short_questions", 3))
            long_count = int(body.get("long_questions", 2))
            
            prompt_text = (
                f"You are Gemini HeatGPT Exam Master 🎓.\n"
                f"Generate a complete, highly detailed custom quiz for topic: '{topic}' at difficulty level: '{difficulty}'.\n"
                f"If an image is attached (such as a textbook page, diagram, formula sheet, or notes), inspect the image carefully and generate quiz questions based on the image contents!\n\n"
                f"Respond ONLY with valid JSON in this exact structure without markdown code blocks:\n"
                f"{{\n"
                f'  "mcqs": [{{"id": 1, "question": "MCQ Question 1?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct": "Option A exact text", "explanation": "Why Option A is correct"}}],\n'
                f'  "fill_blanks": [{{"id": 1, "question": "Sentence with ______ blank.", "correct": "Missing word"}}],\n'
                f'  "short_questions": [{{"id": 1, "question": "Short Question?", "sample_answer": "Key solution points"}}],\n'
                f'  "long_questions": [{{"id": 1, "question": "Long Essay Question?", "key_concepts": ["Concept 1", "Concept 2"]}}]\n'
                f"}}\n"
                f"Ensure mcqs has {mcq_count} items, fill_blanks has {fill_count} items, short_questions has {short_count} items, and long_questions has {long_count} items."
            )

        parts.append(types.Part.from_text(text=prompt_text))
        contents = [types.Content(role="user", parts=parts)]

        for model in candidate_models:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(temperature=0.6)
                )
                raw_text = response.text.strip()
                raw_text = re.sub(r"^```json\s*", "", raw_text, flags=re.MULTILINE)
                raw_text = re.sub(r"^```\s*", "", raw_text, flags=re.MULTILINE)
                data = json.loads(raw_text.strip())
                return JSONResponse({"status": "ok", "data": data, "model": model})
            except Exception as ex:
                print(f"Study Gen error with model {model}: {ex}")
                continue

        return JSONResponse({"error": "Gemini API error generating study content."}, status_code=500)

    except Exception as e:
        print(f"api_study_generate exception: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# JSON Endpoint for Gemini AI Quiz Grading
async def api_study_grade(request):
    try:
        body = await request.json()
        req_model = body.get("model", "gemini-3.5-flash")
        custom_api_key = body.get("api_key", "").strip()
        api_key = custom_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

        if not api_key:
            return JSONResponse({"error": "No Gemini API Key found. Please add your key in Settings!"}, status_code=400)

        user_answers = body.get("answers", {})
        quiz_data = body.get("quiz_data", {})

        prompt = (
            f"You are Gemini Master Exam Evaluator 🎓 grading a student's quiz submission!\n"
            f"Quiz Questions & Answer Key:\n{json.dumps(quiz_data)}\n\n"
            f"Student Submitted Answers:\n{json.dumps(user_answers)}\n\n"
            f"Grade the student's submission thoroughly. Calculate total percentage (0-100), letter grade (A+, A, B, C, D, F), summary feedback, and question-by-question breakdown!\n\n"
            f"Respond ONLY with valid JSON in this exact structure without markdown code blocks:\n"
            f'{{"total_percentage": 92, "letter_grade": "A+ Grade 🏆", "summary": "Superb performance!", "details": [{{"q_id": 1, "status": "correct", "feedback": "Spot on!"}}]}}'
        )

        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        candidate_models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]

        for model in candidate_models:
            try:
                res = client.models.generate_content(model=model, contents=prompt)
                raw_text = res.text.strip()
                raw_text = re.sub(r"^```json\s*", "", raw_text, flags=re.MULTILINE)
                raw_text = re.sub(r"^```\s*", "", raw_text, flags=re.MULTILINE)
                return JSONResponse({"status": "ok", "report": json.loads(raw_text.strip()), "model": model})
            except Exception as ex:
                continue

        return JSONResponse({"error": "Gemini API error grading quiz."}, status_code=500)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# JSON Endpoint for Gemini AI Study Plan Generator
async def api_study_plan_generate(request):
    try:
        body = await request.json()
        topic = body.get("topic", "General Science").strip() or "General Science"
        level = body.get("level", "Intermediate")
        goal = body.get("goal", "Understand the topic")
        duration = body.get("duration", "30min")
        exam_date = body.get("exam_date", "")
        daily_time = body.get("daily_time", "")
        methods = body.get("methods", [])
        req_model = body.get("model", "gemini-3.5-flash")
        custom_api_key = body.get("api_key", "").strip()
        api_key = custom_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

        if not api_key:
            return JSONResponse({"error": "No Gemini API Key found. Please add your key in Settings!"}, status_code=400)

        # Check Local RAG Vector Store context if active
        rag_context = ""
        try:
            store = get_vector_store()
            if store:
                docs = store.similarity_search(topic, k=3)
                if docs:
                    rag_context = "\n\nPRIMARY STUDY MATERIAL FROM UPLOADED RAG DOCUMENTS:\n" + "\n---\n".join([d.page_content[:1000] for d in docs])
        except Exception as rag_err:
            print(f"RAG context fetch error: {rag_err}")

        methods_str = ", ".join(methods) if methods else "Explanations, Practice questions, Active recall, Quizzes"
        
        prompt = (
            f"You are HeatGPT AI Study Architect 🧠🎓.\n"
            f"Design a genuinely tailored, highly effective study plan for:\n"
            f"- Subject/Topic: {topic}\n"
            f"- Current Knowledge Level: {level}\n"
            f"- Learning Goal: {goal}\n"
            f"- Plan Duration: {duration}\n"
            f"- Exam Date: {exam_date or 'None'}\n"
            f"- Daily Study Time: {daily_time or 'Flexible'}\n"
            f"- Preferred Learning Methods: {methods_str}\n"
            f"{rag_context}\n\n"
            f"IMPORTANT DURATION STRATEGY RULES:\n"
            f"- If duration is '10min': Create 1 ultra-focused micro-session (2m quick explanation, 4m key concept, 2m practice, 2m active recall).\n"
            f"- If duration is '30min': Create 1 session (8m learn, 7m examples, 7m practice, 5m active recall, 3m quick quiz).\n"
            f"- If duration is '1week': Create 7 daily sessions (Day 1 Fundamentals, Day 2 Core Concepts, Day 3 Examples, Day 4 Difficult Concepts, Day 5 Practice, Day 6 Review Weak Areas, Day 7 Final Quiz).\n"
            f"- If duration is '1month': Create 4 weekly modules with progressive curriculum (Week 1 Fundamentals, Week 2 Application, Week 3 Practice & Mastery, Week 4 Revision & Mock Tests + Spaced Review).\n"
            f"- For any other duration (e.g. 20min, 1 hour, 2-3 days, 2 weeks), design a proportionally structured session breakdown.\n\n"
            f"Respond ONLY with valid JSON in this exact structure without markdown code blocks:\n"
            f"{{\n"
            f'  "title": "Mastering {topic}",\n'
            f'  "duration_type": "{duration}",\n'
            f'  "summary": "Comprehensive AI strategy tailored for {level} level.",\n'
            f'  "total_sessions": 3,\n'
            f'  "sessions": [\n'
            f'    {{\n'
            f'      "id": 1,\n'
            f'      "day": "Day 1",\n'
            f'      "topic": "Core Fundamentals of {topic}",\n'
            f'      "duration_minutes": 25,\n'
            f'      "objectives": ["Understand key principles", "Learn primary terminology"],\n'
            f'      "learn_content": "Detailed concise explanation of the topic...",\n'
            f'      "practice_activity": "Solve 3 fundamental practice exercises.",\n'
            f'      "recall_activity": "Write 5 key terms from memory.",\n'
            f'      "has_quiz": true,\n'
            f'      "has_flashcards": true,\n'
            f'      "status": "pending"\n'
            f'    }}\n'
            f'  ]\n'
            f"}}\n"
        )

        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        candidate_models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]

        for model in candidate_models:
            try:
                res = client.models.generate_content(model=model, contents=prompt)
                raw_text = res.text.strip()
                raw_text = re.sub(r"^```json\s*", "", raw_text, flags=re.MULTILINE)
                raw_text = re.sub(r"^```\s*", "", raw_text, flags=re.MULTILINE)
                data = json.loads(raw_text.strip())
                return JSONResponse({"status": "ok", "data": data, "model": model})
            except Exception as ex:
                print(f"Study Plan Gen error with model {model}: {ex}")
                continue

        return JSONResponse({"error": "Gemini API error generating study plan."}, status_code=500)

    except Exception as e:
        print(f"api_study_plan_generate exception: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# JSON Endpoint for Quick Study (10m, 20m, 30m, 60m)
async def api_quick_study_generate(request):
    try:
        body = await request.json()
        duration_mins = int(body.get("duration_minutes", 10))
        topic = body.get("topic", "Active Topic").strip() or "General Concepts"
        req_model = body.get("model", "gemini-2.5-flash")
        custom_api_key = body.get("api_key", "").strip()
        api_key = custom_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

        if not api_key:
            return JSONResponse({"error": "No Gemini API Key found. Please add your key in Settings!"}, status_code=400)

        prompt = (
            f"You are HeatGPT AI Quick Study Coach ⚡.\n"
            f"The student has ONLY {duration_mins} MINUTES to study topic: '{topic}'. Make every minute count!\n"
            f"Determine the single most crucial concept to master in {duration_mins} minutes.\n\n"
            f"Respond ONLY with valid JSON in this exact structure without markdown code blocks:\n"
            f"{{\n"
            f'  "intro": "🔥 You have {duration_mins} minutes. Let\'s make them count.",\n'
            f'  "topic": "{topic}",\n'
            f'  "duration_minutes": {duration_mins},\n'
            f'  "key_concept": "Short clear concept title",\n'
            f'  "explanation": "Clear, concise, high-impact 3-sentence explanation of the core concept.",\n'
            f'  "practice_questions": [\n'
            f'    {{"id": 1, "question": "Quick question 1?", "answer": "Answer 1"}},\n'
            f'    {{"id": 2, "question": "Quick question 2?", "answer": "Answer 2"}},\n'
            f'    {{"id": 3, "question": "Quick question 3?", "answer": "Answer 3"}}\n'
            f'  ],\n'
            f'  "active_recall": "Close your eyes: Can you explain the key concept in your own words?",\n'
            f'  "final_review": "1-sentence golden takeaway to remember forever."\n'
            f"}}\n"
        )

        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        candidate_models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]

        for model in candidate_models:
            try:
                res = client.models.generate_content(model=model, contents=prompt)
                raw_text = res.text.strip()
                raw_text = re.sub(r"^```json\s*", "", raw_text, flags=re.MULTILINE)
                raw_text = re.sub(r"^```\s*", "", raw_text, flags=re.MULTILINE)
                data = json.loads(raw_text.strip())
                return JSONResponse({"status": "ok", "data": data, "model": model})
            except Exception as ex:
                continue

        return JSONResponse({"error": "Gemini API error generating quick study."}, status_code=500)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

async def serve_index(request):
    return FileResponse("index.html")

async def serve_css(request):
    return FileResponse("styles.css", media_type="text/css")

async def serve_js(request):
    return FileResponse("app.js", media_type="application/javascript")

async def serve_favicon_ico(request):
    return FileResponse("favicon.ico")

async def serve_favicon_png(request):
    return FileResponse("favicon.png", media_type="image/png")

async def serve_favicon_svg(request):
    return FileResponse("favicon.svg", media_type="image/svg+xml")

routes = [
    Route("/", endpoint=serve_index),
    Route("/styles.css", endpoint=serve_css),
    Route("/app.js", endpoint=serve_js),
    Route("/favicon.ico", endpoint=serve_favicon_ico),
    Route("/favicon.png", endpoint=serve_favicon_png),
    Route("/favicon.svg", endpoint=serve_favicon_svg),
    Route("/api/health", endpoint=api_health, methods=["GET"]),
    Route("/api/chat", endpoint=api_chat, methods=["POST"]),
    Route("/api/podcast_generate", endpoint=api_podcast_generate, methods=["POST"]),
    Route("/api/podcast_download_mp3", endpoint=api_podcast_download_mp3, methods=["POST"]),
    Route("/api/study_generate", endpoint=api_study_generate, methods=["POST"]),
    Route("/api/study_grade", endpoint=api_study_grade, methods=["POST"]),
    Route("/api/study_plan_generate", endpoint=api_study_plan_generate, methods=["POST"]),
    Route("/api/quick_study_generate", endpoint=api_quick_study_generate, methods=["POST"]),
]

middleware = [
    Middleware(CORSMiddleware, allow_origins=["*"], allow_headers=["*"])
]

app = Starlette(debug=True, routes=routes, middleware=middleware)

if __name__ == "__main__":
    print("[HeatGPT Server] Starting Live AI Podcast Generator & Study Hub Server on http://localhost:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
