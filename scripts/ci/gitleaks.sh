#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl --fail --silent --show-error --location https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz --output "$tmp/tool.tar.gz"
printf '%s  %s\n' 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb "$tmp/tool.tar.gz" | sha256sum --check --status
tar -xzf "$tmp/tool.tar.gz" -C "$tmp" gitleaks
mkdir "$tmp/source"
# Full tracked snapshot, including examples/tests. No ignored local .env files, no baseline exclusions.
git archive HEAD | tar -x -C "$tmp/source"
"$tmp/gitleaks" dir "$tmp/source" --config .github/security/gitleaks.toml --redact=100 --no-banner
printf '## Secretos\nGitleaks 8.30.1: snapshot Git completo sin hallazgos. Historial previo no analizado.\n' >> "$GITHUB_STEP_SUMMARY"
