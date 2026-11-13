import { readdirSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const contracts = new Set(['src/features/profesional/api-clinica.test.mjs']);
const regressions = new Set(['src/features/analisis/analisis-onnx.test.mjs']);
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}
const all = ['src/features', 'src/app'].flatMap(walk).filter(p => p.endsWith('.test.mjs')).sort();
const suites = { unitarias: [], integracion: [], contratos: [], regresion: [] };
for (const path of all) {
  const key = path.endsWith('integracion.test.mjs') ? 'integracion' : contracts.has(path) ? 'contratos' : regressions.has(path) ? 'regresion' : 'unitarias';
  suites[key].push(path);
}
if (!all.length || Object.values(suites).some(s => !s.length)) throw new Error('Falta una suite obligatoria');
if (process.argv[2] === '--inventory') {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(suites).map(([k,v]) => [k, {files:v.length, paths:v}])) ,null,2));
} else {
  const category = process.argv[2];
  if (!Object.hasOwn(suites, category)) throw new Error('Categoría inválida');
  mkdirSync('reports', { recursive: true });
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=junit', `--test-reporter-destination=reports/${category}.xml`, ...suites[category]], {stdio:'inherit'});
  if (result.error) throw result.error;
  // Future Stripe/Vitest suite from PR #48 is preserved automatically when merged.
  if (category === 'unitarias' && existsSync('package.json') && JSON.parse(readFileSync('package.json')).scripts?.test) {
    const extra = spawnSync('npm', ['test', '--', '--reporter=default', '--reporter=junit', '--outputFile=reports/vitest.xml'], {stdio:'inherit'});
    if (extra.error) throw extra.error;
    if (extra.status !== 0) process.exit(extra.status ?? 1);
  }
  process.exit(result.status ?? 1);
}
