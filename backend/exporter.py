import json
import base64
from fpdf import FPDF
from typing import Dict, Any

class AdReportPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", 'B', 15)
        self.cell(0, 10, "AdCreative AI: Strategic Script Report", 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", 'I', 8)
        self.cell(0, 10, f"Page {self.page_no()}", 0, 0, 'C')

def generate_pdf_report(data: Dict[str, Any]) -> str:
    """
    Takes JSON result from the frontend and exports it to a b64 string representing a PDF buffer.
    We are using standard english fonts for the MVP as per user approval.
    """
    pdf = AdReportPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Body styling
    pdf.set_font("Helvetica", size=12)
    
    # Metadata mapping
    pdf.set_font("Helvetica", 'B', 12)
    pdf.cell(0, 10, "[Performance Metrics & Prediction]", ln=1)
    
    pdf.set_font("Helvetica", size=10)
    pdf.cell(0, 8, f"Hook Score: {data.get('hook_score', 0)}/100 ({data.get('hook_reasoning', '')})", ln=1)
    pdf.cell(0, 8, f"Clarity Score: {data.get('clarity_score', 0)}/100 ({data.get('clarity_reasoning', '')})", ln=1)
    pdf.cell(0, 8, f"Conversion Score: {data.get('conversion_score', 0)}/100 ({data.get('conversion_reasoning', '')})", ln=1)
    
    pdf.ln(5)
    pdf.set_font("Helvetica", 'B', 10)
    pdf.cell(0, 8, "Psychological Trigger:", ln=1)
    pdf.set_font("Helvetica", size=10)
    # encode to ascii if there are foreign chars to prevent crashing standard helvetica, replace unrenderable
    psycho = str(data.get("psychology_insight", "")).encode('ascii', 'replace').decode('ascii')
    pdf.multi_cell(w=180, h=6, text=psycho)
    
    pdf.ln(5)
    pdf.set_font("Helvetica", 'B', 12)
    pdf.cell(0, 10, "[Directorial Guidance]", ln=1)
    
    pdf.set_font("Helvetica", 'B', 10)
    bgm = str(data.get("bgm_direction", "")).encode('ascii', 'replace').decode('ascii')
    rhythm = str(data.get("editing_rhythm", "")).encode('ascii', 'replace').decode('ascii')
    pdf.multi_cell(w=180, h=6, text=f"BGM Direction: {bgm}")
    pdf.multi_cell(w=180, h=6, text=f"Editing Rhythm: {rhythm}")
    
    pdf.ln(5)
    
    pdf.set_font("Helvetica", 'B', 12)
    pdf.cell(180, 10, "[Script Sequence]", ln=1)
    
    script_data = data.get("script", [])
    for line in script_data:
        pdf.set_font("Helvetica", 'B', 10)
        pdf.cell(180, 8, f"Time: {line.get('time', '')}", ln=1)
        pdf.set_font("Helvetica", 'I', 10)
        vis = str(line.get('visual', '')).encode('ascii', 'replace').decode('ascii')
        pdf.multi_cell(w=180, h=6, text=f"Visual: {vis}")
        
        pdf.set_font("Helvetica", size=10)
        aac = str(line.get('audio_content', '')).encode('ascii', 'replace').decode('ascii')
        aam = str(line.get('audio_meaning', '')).encode('ascii', 'replace').decode('ascii')
        ttc = str(line.get('text_content', '')).encode('ascii', 'replace').decode('ascii')
        ttm = str(line.get('text_meaning', '')).encode('ascii', 'replace').decode('ascii')
        
        pdf.multi_cell(w=180, h=6, text=f"Audio Content: {aac}")
        pdf.multi_cell(w=180, h=6, text=f"Audio Meaning: {aam}")
        pdf.multi_cell(w=180, h=6, text=f"Text Content:  {ttc}")
        pdf.multi_cell(w=180, h=6, text=f"Text Meaning:  {ttm}")
        pdf.ln(3)
        
    pdf.ln(10)
    pdf.set_font("Helvetica", 'B', 12)
    pdf.cell(180, 10, "[Cultural Notes / Warnings]", ln=1)
    pdf.set_font("Helvetica", size=10)
    for note in data.get("cultural_notes", []):
        safenote = str(note).encode('ascii', 'replace').decode('ascii')
        pdf.multi_cell(w=180, h=6, text=f"- {safenote}")
        
    pdf_bytes = pdf.output()
    b64 = base64.b64encode(pdf_bytes).decode('ascii')
    return b64
