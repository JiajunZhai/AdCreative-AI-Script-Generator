import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

# Attempt to load ChromaDB, fallback to Mock DB if build tools missing
try:
    import chromadb
    CHROMA_AVAILABLE = True
    client = chromadb.PersistentClient(path="./chroma_db")
    collection = client.get_or_create_collection(name="creative_genes")
except Exception as e:
    print(f"⚠️ ChromaDB initialization failed: {e}. Falling back to In-Memory DB.")
    CHROMA_AVAILABLE = False
    class MockChromaCollection:
        def __init__(self):
            self.docs = []
            self.metas = []
        def add(self, documents, metadatas, ids):
            self.docs.extend(documents)
            self.metas.extend(metadatas)
            print(f"MockDB Added {len(documents)} records.")
        def query(self, query_texts, n_results):
            if not self.docs:
                return {"documents": [[]]}
            # Dummy return the last N inserted docs
            return {"documents": [self.docs[-n_results:]]}
            
    collection = MockChromaCollection()

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
            req = urllib.request.Request(source_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8')
                # A very rough text extraction (strip tags)
                import re
                raw_text = re.sub(r'<[^>]+>', ' ', html)
        except Exception as e:
            raise Exception(f"Failed to scrape URL: {e}")

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
