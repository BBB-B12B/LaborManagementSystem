import json

with open('.agents/skills/skill-manifest.json', 'r', encoding='utf-8') as f:
    manifest = json.load(f)

for skill_name, data in manifest.get('skills', {}).items():
    print(f"Skill: {skill_name}")
    print(f"Keywords: {data.get('keywords', [])}")
    print(f"Description: {data.get('description', '')}")
    print("-" * 40)
