import {readFileSync, appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const scripts = JSON.parse(readFileSync('package.json')).scripts;
if (scripts.lint) {
  const result = spawnSync('npm', ['run', 'lint'], {stdio:'inherit'});
  process.exit(result.status ?? 1);
}
const message = 'ESLint no está configurado en package.json. TypeScript y SAST se ejecutan en sus jobs obligatorios; este job no acredita lint.\n';
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, message);
