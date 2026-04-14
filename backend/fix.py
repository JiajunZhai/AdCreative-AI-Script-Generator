import sys, os

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    extracted_usp, extract_tokens, extract_used_llm = extract_usp_via_llm_with_usage(
        data["title"], data, request.engine
    )'''

replacement = '''    if request.engine == 'cloud' and cloud_client:
        from scraper import EXTRACT_USP_VIA_LLM_SYSTEM_PROMPT, _serialize_director_archive, _validate_director_archive
        import json
        desc = data.get("description", "")[:1500]
        genre = data.get("genre", "Game")
        installs = data.get("installs", "Unknown")
        recent_changes = data.get("recentChanges", "")[:300]
        
        user_prompt = (
            f"Game title: {data.get('title')}\\n"
            f"Genre (store): {genre}\\n"
            f"Installs (store label): {installs}\\n"
            f"Recent changes / What's new:\\n{recent_changes}\\n\\n"
            f"--- Raw store description (may truncate) ---\\n{desc}\\n"
        )
        try:
            response = cloud_client.chat.completions.create(
                model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
                response_format={ "type": "json_object" },
                messages=[
                    {"role": "system", "content": EXTRACT_USP_VIA_LLM_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ]
            )
            raw_content = response.choices[0].message.content
            parsed = json.loads(raw_content)
            
            if _validate_director_archive(parsed):
                extracted_usp = _serialize_director_archive(parsed, installs, recent_changes)
                extract_tokens = response.usage.total_tokens if hasattr(response, 'usage') and response.usage else 0
                extract_used_llm = True
            else:
                raise ValueError("JSON validation failed")
        except Exception as e:
            print(f"Cloud extract failed, fallback: {e}")
            from scraper import extract_usp_via_llm_with_usage as ext_fallback
            extracted_usp, extract_tokens, extract_used_llm = ext_fallback(data["title"], data, "mock")
    else:
        from scraper import extract_usp_via_llm_with_usage as ext_fallback
        extracted_usp, extract_tokens, extract_used_llm = ext_fallback(data["title"], data, request.engine)'''

target_crlf = target.replace('\n', '\r\n')
if target in content:
    content = content.replace(target, replacement)
elif target_crlf in content:
    content = content.replace(target_crlf, replacement)
else:
    print('Target not found!')
    sys.exit(1)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Replaced successfully')
