# Reproducir la validación documental

Ejecutar desde la raíz del repositorio con Python 3 y Node.js 22. Estas herramientas no aplican SQL ni consultan servicios. No regenerar los inventarios verificados como si fueran consultas nuevas.

```powershell
python docs/arquitectura/herramientas/generar_modelo.py
python docs/arquitectura/herramientas/actualizar_documentos.py
python docs/arquitectura/herramientas/cerrar_documentos.py
python docs/arquitectura/herramientas/revisar_contratos.py
```

Los generadores sobrescriben documentos derivados: revisar su diff antes de conservar modificaciones manuales. La evidencia de ejecución final y el manifiesto se actualizan después de regenerar, no se deducen del éxito del generador.

Instalar el parser fuera de las dependencias del proyecto y ejecutar la comprobación:

```powershell
python -m pip install --target "$env:TEMP/DentaIA-arquitectura-parser" pglast
python docs/arquitectura/herramientas/validar_arquitectura.py --parser-dir "$env:TEMP/DentaIA-arquitectura-parser"
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
git diff --check
```

En esta auditoría se reutilizó una instalación temporal de pglast existente. El parser comprueba gramática, no ejecución, resolución de tipos ni privilegios de PostgreSQL. La comprobación de preservación utiliza un inventario SHA temporal de los originales cuando está disponible; en otra máquina contrastar también el manifiesto original.

## Render Mermaid

Se utilizó `@mermaid-js/mermaid-cli@12.2.0` desde la caché temporal de npm y un Chrome headless aislado, sin modificar package.json ni package-lock.json. Crear fuera del repositorio un JSON de Puppeteer con `executablePath` apuntando al Chrome local y `headless: true`; ese archivo es específico de cada máquina.

```powershell
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'
Get-ChildItem docs/arquitectura/diagramas/*.mmd | ForEach-Object {
  npx --yes --package=@mermaid-js/mermaid-cli@12.2.0 mmdc -p "$env:TEMP/DentaIA-arquitectura-puppeteer.json" -i $_.FullName -o "docs/arquitectura/renderizados/$($_.BaseName).svg" -b white
  if ($LASTEXITCODE -ne 0) { throw 'Falló el render Mermaid' }
}
```

Los SVG se inspeccionan como XML y se conserva el hash de cada fuente y render. La revisión visual manual de esta auditoría abarcó el DER general y el clínico; no equivale a revisar visualmente cada uno de los 17 gráficos.

## SQL: límite explícito

Los siete borradores están protegidos para una base QA desechable con prefijo y GUC específicos. No quitar esos controles para ejecutarlos en Dental-IA. No se ejecutó ninguno: Docker estaba instalado sin daemon disponible y no había PostgreSQL local. Preparar primero el entorno y las pruebas descritas en [Pruebas y limitaciones](../PRUEBAS_Y_LIMITACIONES.md).
