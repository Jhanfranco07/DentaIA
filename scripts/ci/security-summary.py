import json, os, sys
report=json.load(open(sys.argv[1]))
with open(os.environ.get('GITHUB_STEP_SUMMARY','/dev/stdout'),'a') as f:
 f.write(f"## SAST Semgrep\nHallazgos: {len(report.get('results', []))}. Errores del analizador: {len(report.get('errors', []))}. Reglas locales versionadas; no equivale a una auditoría exhaustiva.\n")
if report.get('results') or report.get('errors'): sys.exit(1)
