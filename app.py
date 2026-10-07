import sys
import io
import os
import re
import shutil

# Ensure UTF-8 output encoding for Windows standard streams
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import streamlit as st
import pandas as pd
from dotenv import load_dotenv

# LangChain & Local Vector Store Imports
from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma

try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    from langchain_community.embeddings import HuggingFaceEmbeddings

from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

# Page Configuration
st.set_page_config(
    page_title="HeatGPT AI Assistant",
    page_icon="🔥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom HeatGPT Theme Styling
st.markdown("""
<style>
    /* Global Background & Typography */
    .stApp {
        background-color: #090d16;
        color: #f8fafc;
        font-family: 'Inter', sans-serif;
    }

    /* Sidebar Styling */
    [data-testid="stSidebar"] {
        background-color: #0f172a;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    /* Header Card */
    .heatgpt-header {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-radius: 16px;
        padding: 20px 24px;
        border: 1px solid rgba(249, 115, 22, 0.3);
        margin-bottom: 24px;
        box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);
    }
    
    .heatgpt-title {
        color: #f97316;
        font-size: 2.2rem;
        font-weight: 800;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .heatgpt-subtitle {
        color: #94a3b8;
        font-size: 1rem;
        margin-top: 6px;
    }

    /* Source Cards */
    .source-card {
        background-color: #1e293b;
        border-left: 4px solid #f97316;
        padding: 10px 14px;
        border-radius: 6px;
        margin-top: 8px;
        font-size: 0.88rem;
    }
    
    .source-meta {
        color: #f97316;
        font-weight: 700;
        margin-bottom: 4px;
    }
</style>
""", unsafe_allow_html=True)

# Document Loading & Processing for RAG
@st.cache_resource(show_spinner=False)
def load_and_process_documents(txt_path="policy.txt", xlsx_path="products.xlsx"):
    all_documents = []
    stats = {"policy_count": 0, "product_count": 0}

    if os.path.exists(txt_path):
        try:
            loader = TextLoader(txt_path, encoding="utf-8")
            policy_docs = loader.load()
            for doc in policy_docs:
                doc.metadata["source"] = os.path.basename(txt_path)
                doc.metadata["type"] = "Company Policy"
            all_documents.extend(policy_docs)
            stats["policy_count"] = len(policy_docs)
        except Exception as e:
            st.error(f"Error loading policy document '{txt_path}': {e}")

    if os.path.exists(xlsx_path):
        try:
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
        except Exception as e:
            st.error(f"Error loading products Excel file '{xlsx_path}': {e}")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_documents(all_documents)
    stats["total_chunks"] = len(chunks)

    return chunks, stats, df if 'df' in locals() else pd.DataFrame()

# Local Vector Store Initialization
@st.cache_resource(show_spinner=False)
def initialize_vector_store(_chunks):
    embedding_fn = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    collection_name = "local_docs_384"
    persist_dir = "./chroma_db_local"

    try:
        vector_store = Chroma.from_documents(
            documents=_chunks,
            embedding=embedding_fn,
            collection_name=collection_name,
            persist_directory=persist_dir
        )
    except Exception:
        shutil.rmtree(persist_dir, ignore_errors=True)
        vector_store = Chroma.from_documents(
            documents=_chunks,
            embedding=embedding_fn,
            collection_name=collection_name,
            persist_directory=persist_dir
        )
    
    return vector_store

# Local RAG Answer Generator
def answer_question_local(question, vector_store):
    retriever = vector_store.as_retriever(search_kwargs={"k": 4})
    retrieved_docs = retriever.invoke(question)

    if not retrieved_docs:
        return ("No relevant company documents found.", [])

    device_docs = [d for d in retrieved_docs if d.metadata.get("type") == "Device Record"]
    policy_docs = [d for d in retrieved_docs if d.metadata.get("type") == "Company Policy"]

    response_blocks = []

    if device_docs:
        response_blocks.append("### 💻 Device Information Found\n")
        for doc in device_docs:
            response_blocks.append(doc.page_content)
            response_blocks.append("")

    if policy_docs:
        response_blocks.append("### 📜 Company Policy Information\n")
        for doc in policy_docs:
            response_blocks.append(doc.page_content)
            response_blocks.append("")

    if not response_blocks:
        response_blocks.append("### 🔍 Search Results\n")
        for doc in retrieved_docs:
            response_blocks.append(doc.page_content)

    final_answer = "\n".join(response_blocks).strip()
    return final_answer, retrieved_docs

# Main Streamlit App
def main():
    # Header UI
    st.markdown("""
        <div class="heatgpt-header">
            <h1 class="heatgpt-title">🔥 HeatGPT AI Assistant</h1>
            <p class="heatgpt-subtitle">General AI intelligence powered by Gemini 2.5 Flash + Local Document Knowledge Base (RAG).</p>
        </div>
    """, unsafe_allow_html=True)

    # Sidebar
    with st.sidebar:
        st.header("⚙️ Chat Settings")
        
        mode = st.radio(
            "Operating Mode",
            ["🔥 General HeatGPT AI", "📚 Local Knowledge Base (RAG)"],
            index=0
        )
        
        st.divider()

        api_key_input = st.text_input(
            "Gemini API Key",
            type="password",
            value=os.environ.get("GEMINI_API_KEY", ""),
            help="Configured and saved."
        )

        model_name = st.selectbox(
            "Model Engine",
            ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-pro"]
        )

        st.divider()

        # Document Stats for RAG mode
        chunks, stats, df_products = load_and_process_documents()
        vector_store = initialize_vector_store(chunks) if chunks else None

        with st.expander("📊 Local Index Statistics"):
            col1, col2 = st.columns(2)
            col1.metric("Policy Docs", stats.get("policy_count", 0))
            col2.metric("Products/Devices", stats.get("product_count", 0))
            st.metric("Total Indexed Chunks", stats.get("total_chunks", 0))

        if st.button("🗑️ Clear Chat History"):
            st.session_state["messages"] = []
            st.rerun()

    # Session State Chat History
    if "messages" not in st.session_state:
        st.session_state["messages"] = [
            {
                "role": "assistant",
                "content": "Hello! I am **HeatGPT**. Ask me any general question, programming task, or switch to **Local Knowledge Base** mode in the sidebar to search company documents!",
                "sources": []
            }
        ]

    # Display Chat Feed
    for msg in st.session_state["messages"]:
        avatar = "🔥" if msg["role"] == "assistant" else "👤"
        with st.chat_message(msg["role"], avatar=avatar):
            st.markdown(msg["content"])
            if msg.get("sources"):
                with st.expander("🔍 View Grounded Document Sources"):
                    for idx, doc in enumerate(msg["sources"]):
                        st.markdown(f"""
                        <div class="source-card">
                            <div class="source-meta">Source #{idx+1}: {doc.metadata.get('source')} ({doc.metadata.get('type')})</div>
                            <div>{doc.page_content}</div>
                        </div>
                        """, unsafe_allow_html=True)

    # Chat Input Box
    if user_query := st.chat_input("Message HeatGPT..."):
        # Append User Message
        st.session_state["messages"].append({"role": "user", "content": user_query, "sources": []})
        with st.chat_message("user", avatar="👤"):
            st.markdown(user_query)

        # Generate Assistant Response
        with st.chat_message("assistant", avatar="🔥"):
            if "Local Knowledge Base" in mode:
                with st.spinner("Searching local document vector index..."):
                    answer_text, sources = answer_question_local(user_query, vector_store)
                    st.markdown(answer_text)
                    if sources:
                        with st.expander("🔍 View Grounded Document Sources"):
                            for idx, doc in enumerate(sources):
                                st.markdown(f"""
                                <div class="source-card">
                                    <div class="source-meta">Source #{idx+1}: {doc.metadata.get('source')} ({doc.metadata.get('type')})</div>
                                    <div>{doc.page_content}</div>
                                </div>
                                """, unsafe_allow_html=True)
                    st.session_state["messages"].append({
                        "role": "assistant",
                        "content": answer_text,
                        "sources": sources
                    })
            else:
                # General AI Mode
                effective_key = api_key_input or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
                if not effective_key:
                    warning_msg = ("⚠️ **No Gemini API Key provided.**\n\n"
                                   "Please enter your Google Gemini API Key in the sidebar, or set `GEMINI_API_KEY` in `.env` "
                                   "to use real-time HeatGPT AI.")
                    st.markdown(warning_msg)
                    st.session_state["messages"].append({
                        "role": "assistant",
                        "content": warning_msg,
                        "sources": []
                    })
                else:
                    try:
                        client = genai.Client(api_key=effective_key)
                        formatted_contents = []
                        for m in st.session_state["messages"]:
                            role = "user" if m["role"] == "user" else "model"
                            formatted_contents.append(types.Content(
                                role=role,
                                parts=[types.Part.from_text(text=m["content"])]
                            ))
                        
                        response = client.models.generate_content_stream(
                            model=model_name,
                            contents=formatted_contents,
                            config=types.GenerateContentConfig(
                                system_instruction="You are HeatGPT, an ultra-smart, helpful AI assistant."
                            )
                        )
                        full_response = st.write_stream((chunk.text for chunk in response if chunk.text))
                        st.session_state["messages"].append({
                            "role": "assistant",
                            "content": full_response,
                            "sources": []
                        })
                    except Exception as e:
                        err_text = f"❌ **Error connecting to Gemini API**: {e}"
                        st.error(err_text)
                        st.session_state["messages"].append({
                            "role": "assistant",
                            "content": err_text,
                            "sources": []
                        })

if __name__ == "__main__":
    main()
