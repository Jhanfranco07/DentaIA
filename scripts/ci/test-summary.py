"""Metrics from real JUnit leaf suites, without double counting nested suites."""
import os, sys, xml.etree.ElementTree as ET
lines=['## Resultados reales de pruebas\n', '| Informe | Casos | Exitosos | Fallidos/errores | Omitidos | Segundos |', '| --- | --- | --- | --- | --- | --- |']
for path in sys.argv[1:]:
 root=ET.parse(path).getroot()
 cases=list(root.iter('testcase'))
 failed=sum(c.find('failure') is not None or c.find('error') is not None for c in cases)
 skipped=sum(c.find('skipped') is not None for c in cases)
 duration=sum(float(c.get('time', '0')) for c in cases)
 lines.append(f'| {os.path.basename(path)} | {len(cases)} | {len(cases)-failed-skipped} | {failed} | {skipped} | {duration:.3f} |')
with open(os.environ.get('GITHUB_STEP_SUMMARY','/dev/stdout'),'a') as f: f.write('\n'.join(lines)+'\n')
