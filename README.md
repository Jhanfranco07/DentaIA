# DentAI · Prototipo académico para pacientes

Aplicación de demostración desarrollada con **Next.js 15, React 19 y TypeScript** para el proyecto final de carrera. Orientación preventiva de salud bucal y directorio de profesionales.

## Ejecutar el MVP original

Usar Node.js 22 LTS (ver `.nvmrc`).

```bash
npm ci
npm run dev
npm run build
```

## Base común para los cuatro avances

La conexión cliente a Supabase, los tipos de las cinco tablas y las rutas separadas están preparados.
**Los módulos todavía deben ser implementados por cada integrante.** El recorrido original de `/` se conserva.

```bash
cp .env.example .env.local
npm run check:supabase
npm run dev
```

Abrir `/desarrollo/acceso` para comprobar la conexión e iniciar una sesión de prueba.
Esta herramienta solo existe en desarrollo; no reemplaza el login final.
Las cuentas deben crearse previamente: [guía del equipo](docs/DESARROLLO.md).

| Integrante | Ruta propia | Avance por implementar |
| --- | --- | --- |
| Jhan | `/cuenta` | Registro, login, cierre y perfil persistente |
| Angie | `/directorio` | Consulta remota, búsqueda, filtros y detalle |
| Anelis | `/solicitudes` | Crear, consultar y cancelar solicitudes de demostración |
| Stephan | `/fotografias` | Consentimiento, carga privada y eliminación |

No compartir contraseñas de BD ni claves secretas con el equipo. `.env.example` solo contiene
la URL y clave publicable; los datos privados están protegidos por permisos y políticas RLS.

## Publicación en Vercel
Importar `Jhanfranco07/DentaIA`, usar el framework **Next.js** y el directorio raíz.
El recorrido original no requiere variables de entorno. Los módulos conectados a Supabase requerirán
las dos variables `NEXT_PUBLIC_` de `.env.example`. La herramienta de desarrollo devuelve 404 en producción.
Preparar esta base no publica ni despliega una nueva versión.

## Funcionalidades
- Inicio responsivo y recorrido educativo.
- Consentimiento explícito y vista previa de imágenes JPG, PNG o WebP de hasta 8 MB.
- El archivo permanece en el navegador; no se sube ni almacena en servidores.
- Reporte **ficticio**, no condicionado por la fotografía.
- Directorio de odontólogos y precios **ficticios**, con búsqueda y filtros.
- Información de privacidad y alcance del prototipo.

**Importante:** no existe ningún análisis automatizado ni diagnóstico clínico. Ante dolor o urgencia hay que consultar a un profesional. El modelo IA y los datos verificados corresponden a fases posteriores.

## Convención de commits
En español: `feat: desarrollar navegación del paciente`; `fix: corregir validación de imágenes`; `docs: explicar alcance académico`.
