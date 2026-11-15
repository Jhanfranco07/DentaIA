"""Strict gate over direct dependencies; no skipped/cancelled stage can pass."""
import json, os, sys
needs = json.loads(os.environ['NEEDS_JSON'])
passed = bool(needs) and all(v['result'] == 'success' for v in needs.values())
text = f"## {os.getenv('GITHUB_WORKFLOW', 'Pipeline')}\nCommit: `{os.getenv('GITHUB_SHA', '')}` · Rama: `{os.getenv('GITHUB_HEAD_REF') or os.getenv('GITHUB_REF_NAME', '')}`\n\n| Etapa | Resultado |\n| --- | --- |\n"
text += ''.join(f"| {k} | {v['result']} |\n" for k,v in needs.items())
text += f"\nQuality Gate: **{'aprobado' if passed else 'fallido'}**.\n"
with open(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/stdout'), 'a') as f: f.write(text)
if '--gate' in sys.argv and not passed: sys.exit('Fallo, cancelación u omisión de una etapa obligatoria')
