import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

import json
import uuid
import os
import numpy as np
from dotenv import load_dotenv

load_dotenv()

# We have sunset ChromaDB due to Python 3.14+ Pydantic compatibility failure
# Upgrading to a zero-dependency (native numpy+scikit) persistent Vector Matrix
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("[WARN] Scikit-Learn not found. Run pip install scikit-learn. Falling back to memory-only.")
    TfidfVectorizer = None

class ScikitLearnLocalDB:
    def __init__(self, db_path="./chroma_db/local_storage.json"):
        self.db_path = db_path
        self.docs = []
        self.metas = []
        self.vectorizer = TfidfVectorizer() if TfidfVectorizer else None
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.load()

    def save(self):
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump({"docs": self.docs, "metas": self.metas}, f, ensure_ascii=False)

    def load(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.docs = data.get("docs", [])
                    self.metas = data.get("metas", [])
            except Exception:
                pass

    def add(self, documents, metadatas, ids):
        self.docs.extend(documents)
        self.metas.extend(metadatas)
        self.save()
        print(f"[RAG] Local matrix DB added {len(documents)} records (total: {len(self.docs)}).")

    def query(self, query_texts, n_results=3):
        if not self.docs or not self.vectorizer:
            return {"documents": [[]]}
            
        # 1. Fit TF-IDF on our complete knowledge base
        tfidf_matrix = self.vectorizer.fit_transform(self.docs)
        
        # 2. Transform the incoming search queries (handles batch)
        query_vecs = self.vectorizer.transform(query_texts)
        
        # 3. Calculate cosine similarity
        similarities = cosine_similarity(query_vecs, tfidf_matrix)
        
        batch_results = []
        batch_metas = []
        for sim_scores in similarities:
            top_indices = np.argsort(sim_scores)[::-1][:n_results]
            
            results = [self.docs[i] for i in top_indices if sim_scores[i] > 0] 
            metas = [self.metas[i] for i in top_indices if sim_scores[i] > 0] 
            
            if not results and self.docs:
                results = self.docs[-n_results:] 
                metas = self.metas[-n_results:] 
                
            batch_results.append(results)
            batch_metas.append(metas)
            
        return {"documents": batch_results, "metadatas": batch_metas}

collection = ScikitLearnLocalDB()
CHROMA_AVAILABLE = True # DB operates fully natively

def distill_and_store(raw_text: str, source_url: str, year_quarter: str = "Unknown Date"):
    """
    Distills raw reports into atomic JSON insights and stores them in Vector Engine.
    Requires DeepSeek V3 for reasoning extraction.
    If raw_text is empty and source_url is provided, it attempts to scrape the URL.
    """
    from openai import OpenAI
    cloud_client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    ) if os.getenv("DEEPSEEK_API_KEY") else None

    if not cloud_client:
        raise Exception("DeepSeek API Key missing for distillation.")

    system_prompt = """
    You are a Master Mobile Game User Acquisition Strategist.
    I will provide you with a raw industry report, competitor analysis, or market research text.
    You must distill the core 'Creative Genes' (execution rules) out of it.
    Format your response STRICTLY as a JSON array of objects representing atomic insights.
    
    Each object must have:
    {
      "region": "<Target region this applies to, e.g., Japan, Global, MENA>",
      "style": "<Visual/Editing style category>",
      "logic": "<The exact visual execution rule>",
      "psychology": "<Psychological trigger reasoning>"
    }
    
    CRITICAL: Output ONLY valid JSON array starting with `[` and ending with `]`. No markdown wrappers.
    """

    if not raw_text.strip() and source_url.strip():
        try:
            import urllib.request
            from bs4 import BeautifulSoup
            req = urllib.request.Request(source_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8')
                
                soup = BeautifulSoup(html, 'html.parser')
                # Remove non-content tags
                for tag in soup(["script", "style", "nav", "footer", "meta", "noscript", "header"]):
                    tag.decompose()
                
                raw_text = soup.get_text(separator=' ', strip=True)
        except Exception as e:
            raise Exception(f"Failed to scrape URL with BeautifulSoup: {e}")

    try:
        response = cloud_client.chat.completions.create(
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract UA creative genes from the following report:\n\n{raw_text[:8000]}"}
            ]
        )
        
        raw_output = response.choices[0].message.content
        # Regex to strip markdown backticks if any
        import re
        match = re.search(r'(\[.*\])', raw_output, re.DOTALL)
        if match:
            raw_output = match.group(1)
            
        insights = json.loads(raw_output)
        
        if not isinstance(insights, list):
            raise Exception("Distillation did not return a list.")
            
        documents = []
        metadatas = []
        ids = []
        
        for idx, insight in enumerate(insights):
            # The document to embed is the logic string and psychology combined
            doc_str = f"[{insight.get('region', 'Global')}] Style: {insight.get('style', '')} - {insight.get('logic', '')} (Why: {insight.get('psychology', '')})"
            documents.append(doc_str)
            metadatas.append({
                "source": source_url,
                "region": insight.get('region', 'Global'),
                "year_quarter": year_quarter
            })
            ids.append(str(uuid.uuid4()))
            
        if documents:
            collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
        return {"success": True, "extracted_count": len(documents), "insights": insights}
        
    except Exception as e:
        print(f"Distillation failed: {e}")
        return {"success": False, "error": str(e)}

def retrieve_context(query_string: str, top_k: int = 3) -> tuple[str, list[str]]:
    """
    Search ChromaDB for relevant insights matching the query.
    Returns (Compiled Context String, List of Citation Strings)
    """
    try:
        results = collection.query(
            query_texts=[query_string],
            n_results=top_k
        )
        
        if not results or not results.get("documents") or not results["documents"][0]:
            return "", []
            
        retrieved_docs = results["documents"][0] # list of strings
        # ChromaDB meta map structure
        retrieved_metas = results["metadatas"][0] if results.get("metadatas") and results["metadatas"][0] else []
        
        context = "[Market Context from Vector Intelligence]\n"
        citations = []
        
        for i, doc in enumerate(retrieved_docs):
            context += f"- Context Rule {i+1}: {doc}\n"
            if i < len(retrieved_metas) and retrieved_metas[i] is not None:
                source = retrieved_metas[i].get("source", "Unknown Oracle Database")
                year_q = retrieved_metas[i].get("year_quarter", "")
                cite = f"{source} ({year_q})" if year_q else source
                if cite not in citations:
                    citations.append(cite)
                    
        return context, citations
    except Exception as e:
        print(f"RAG Retrieval failed: {e}")
        return "", []

def get_collection_stats() -> dict:
    """Returns total rule count and the last 10 inserted intel items."""
    total = len(collection.docs)
    recent = []
    
    last_n = min(10, total)
    if last_n > 0:
        docs = collection.docs[-last_n:]
        metas = collection.metas[-last_n:]
        
        for i in range(last_n):
            idx = last_n - 1 - i # reverse order
            meta = metas[idx] or {}
            doc = docs[idx] or ""
            
            cat = meta.get("category", "")
            if cat.startswith("region_"):
                region = meta.get("element", "Region")
                tag = "Cultural"
            elif cat.startswith("style_"):
                region = "Global"
                tag = "Style"
            elif cat.startswith("logic_"):
                region = "Global"
                tag = "Mechanics"
            else:
                region = "Global"
                tag = cat or "General"
                
            recent.append({
                "id": str(i),
                "region": region,
                "tag": tag,
                "title": doc[:60] + "..." if len(doc) > 60 else doc,
                "time": meta.get("year_quarter", "N/A"),
                "link": meta.get("source", "#"),
                "source": "Oracle Vault",
                "stat": f"Rank {meta.get('score', 85)}"
            })
            
    return {"total_rules": total, "recent_intel": recent}
