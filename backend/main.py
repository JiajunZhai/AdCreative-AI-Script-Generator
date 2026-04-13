from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
cloud_client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
) if os.getenv("DEEPSEEK_API_KEY") else None

app = FastAPI(
    title="AdCreative AI Script Generator API",
    description="Backend API for generating structured video ad scripts using AI with Culture Intelligence.",
    version="1.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateScriptRequest(BaseModel):
    title: str
    usp: str
    platform: str
    angle: str
    region: str = Field(default="NA/EU", description="Target region for culture intelligence")
    engine: str = Field(default="cloud", description="The LLM source engine (cloud or local)")

class GenerateScriptResponse(BaseModel):
    hook_score: int
    hook_reasoning: str
    clarity_score: int
    clarity_reasoning: str
    conversion_score: int
    conversion_reasoning: str
    bgm_direction: str
    editing_rhythm: str
    script: list[dict]
    psychology_insight: str
    cultural_notes: list[str]
    competitor_trend: str
    citations: list[str] = []

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AdCreative AI Engine Sandbox is running"}

from prompts import get_system_prompt_template

from scraper import fetch_playstore_data, extract_usp_via_llm_mock
from exporter import generate_pdf_report
from refinery import retrieve_context, distill_and_store

class GeneratePdfRequest(BaseModel):
    data: dict

@app.post("/api/export/pdf")
def export_pdf(request: GeneratePdfRequest):
    try:
        pdf_b64 = generate_pdf_report(request.data)
        return {"success": True, "pdf_base64": pdf_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ExtractUrlRequest(BaseModel):
    url: str
    engine: str = Field(default="cloud", description="The LLM source engine (cloud or local)")

class ExtractUrlResponse(BaseModel):
    success: bool
    title: str = ""
    extracted_usp: str = ""
    error: str = ""

@app.post("/api/extract-url", response_model=ExtractUrlResponse)
def extract_url(request: ExtractUrlRequest):
    data = fetch_playstore_data(request.url)
    
    if not data["success"]:
        return {"success": False, "error": data.get("error", "Failed to parse.")}
        
    extracted_usp = extract_usp_via_llm_mock(data["title"], data, request.engine)
    
    return {
        "success": True,
        "title": data["title"],
        "extracted_usp": extracted_usp
    }

class IngestRequest(BaseModel):
    raw_text: str = ""
    source_url: str
    year_quarter: str = "Unknown Date"

class IngestResponse(BaseModel):
    success: bool
    extracted_count: int = 0
    error: str = ""

@app.post("/api/refinery/ingest", response_model=IngestResponse)
def ingest_report(request: IngestRequest):
    result = distill_and_store(request.raw_text, request.source_url, request.year_quarter)
    return {
        "success": result.get("success", False),
        "extracted_count": result.get("extracted_count", 0),
        "error": result.get("error", "")
    }

@app.post("/api/generate", response_model=GenerateScriptResponse)
def generate_script(request: GenerateScriptRequest):
    # 0. Query Oracle (RAG Retrieval)
    oracle_context, citations = retrieve_context(f"{request.region} {request.angle} {request.usp}", top_k=3)

    # 1. 模拟组装 Prompt 引擎
    generated_system_prompt = get_system_prompt_template(
        title=request.title,
        usp=request.usp,
        platform=request.platform,
        angle=request.angle,
        region=request.region,
        oracle_context=oracle_context
    )
    # 控制台打印生成的超级 Prompt
    print("\n" + "="*50)
    print("🔥 [SYSTEM PROMPT GENERATED] 🔥")
    print("="*50)
    print(generated_system_prompt)
    print("="*50 + "\n")

    # Mock Localization & Culture Intelligence Logic
    cultural_notes = []
    competitor_trend = ""
    is_rtl = False
    
    if request.region == "Japan":
        cultural_notes = [
            "Requirement: Highlight Voice Actor (CV) names prominently.",
            "Visual: Vertical UI composition with heavy emphasis on character gacha/art.",
            "Caution: Avoid abrupt/rough transitions, ensure grammatically perfect native translation."
        ]
        competitor_trend = f"75% of top ads in Japan for '{request.angle}' style use top-tier CV voiceovers. Try to incorporate character name-drops."
    elif request.region == "Southeast Asia":
        cultural_notes = [
            "Visual: High contrast, gold/red color schemes.",
            "Offer: Emphasize 'Free Draws' or 'Gift Codes' in the first 3 seconds.",
            "Style: Exaggerated KOL reactions perform best."
        ]
        competitor_trend = f"Current SEA trend highly favors numeric inflation and extreme visual rewards. 'Free 1000 Draws' CTA is highly recommended."
    elif request.region == "Middle East":
        cultural_notes = [
            "Compliance Rule: No references to alcohol, pigs, or religiously sensitive attire.",
            "Formatting Rule: RTL (Right-to-Left) typography required for Arabic.",
            "Visual: Desert/Gold palettes with emphasis on tribal/clan honor perform 30% better."
        ]
        competitor_trend = f"'Clan vs Clan' massive battle setups are driving the lowest CPIs in Middle East SLG ads."
        is_rtl = True
    else: # NA / EU
        cultural_notes = [
            "Style: UGC (User Generated Content) raw/home-style reviews convert best.",
            "Direction: Personal heroism and fail-bait logic.",
            "Caution: Avoid overly polished 'fake' cinematic trailers."
        ]
        competitor_trend = f"Fail-bait puzzles are currently dominating NA/EU charts with a 4% average CTR."

    # Local Engine Routing
    if request.engine == "local":
        from ollama_client import generate_with_local_llm
        local_result = generate_with_local_llm(
            system_prompt=generated_system_prompt,
            user_input="Generate the localized script according to the constraints.",
            model="qwen3.5:9b", # Using Qwen3.5:9b as directed for Director Script execution
            expected_json=True
        )
        if isinstance(local_result, dict):
            local_result["citations"] = citations
        return local_result

    if cloud_client:
        try:
            print("🧠 DeepSeek Cloud Engine detected. Igniting AI reasoning capabilities...")
            # We explicitly add raw json instruction to prevent truncation or markdown wrapper blocks
            generated_system_prompt += "\n\nCRITICAL: Return only the raw JSON. Ensure the JSON object is complete and valid with no markdown wrappers."

            # Note: DeepSeek response_format behavior is supported
            response = cloud_client.chat.completions.create(
                model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
                response_format={ "type": "json_object" },
                messages=[
                    {"role": "system", "content": generated_system_prompt},
                    {"role": "user", "content": "Generate the localized script according to the constraints."}
                ]
            )
            raw_json = response.choices[0].message.content
            parsed = json.loads(raw_json)
            parsed["citations"] = citations
            # Ensure the output maps to the model
            return parsed
        except Exception as e:
            print(f"❌ DeepSeek API Failed: {e}. Falling back to intelligence mock.")

    print("⚠️  No Cloud API Key or Request Errored. Falling back to Mock Data Model.")
    return {
        "hook_score": 92,
        "hook_reasoning": f"High saturation visual conflict. Opening with a dramatic {request.title} failure triggers immediate pattern interruption.",
        "clarity_score": 85,
        "clarity_reasoning": f"UI symbolic clarity. The '{request.usp}' mechanic is instantly understandable without any voiceover narrative.",
        "conversion_score": 78,
        "conversion_reasoning": "Clear emotional reward. The viewer feels a strong urge to correct the mistake and download the game to fix it.",
        "psychology_insight": "FOMO & Cognitive Dissonance (The viewer's brain rejects the stupidity of the ad and wants to resolve the puzzle).",
        "bgm_direction": "High energy phonk / rhythmic beats matching the fail state.",
        "editing_rhythm": "Fast jump cuts every 0.5s for the first 3 seconds, then a long agonizing pause on the fail screen.",
        "script": [
            {
                "time": "0s",
                "visual": f"(中文指令) 玩家队伍卡在 {request.title} 的第一关。呈现极度夸张的失败动画效果，屏幕震动。",
                "audio_content": "هل أنت أذكى من هذا؟" if is_rtl else "99% の人はこれをクリアできません！" if request.region == "Japan" else "99% of people can't pass this!",
                "audio_meaning": "99%的人无法通关！",
                "text_content": "🧠IQ TEST🧠" if not is_rtl else "🧠 اختبار الذكاء 🧠",
                "text_meaning": "智商测试"
            },
            {
                "time": "3s",
                "visual": f"(中文指令) 玩家盲目使用了 {request.usp} 道具，但属性完全不对，导致全军覆没。跳出巨大红叉。",
                "audio_content": "حاول مرة أخرى!" if is_rtl else "もう一度やってみろ！" if request.region == "Japan" else "Loud buzzer sound. Try again!",
                "audio_meaning": "发出巨大错误提示音，再试一次！",
                "text_content": "FAIL" if not is_rtl else "فشل",
                "text_meaning": "失败"
            }
        ],
        "cultural_notes": cultural_notes,
        "competitor_trend": competitor_trend,
        "citations": citations
    }
