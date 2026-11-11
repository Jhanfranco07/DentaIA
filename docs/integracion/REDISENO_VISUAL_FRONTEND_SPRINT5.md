# Rediseño visual del frontend — Sprint 5

Fecha de validación: 2026-11-05 (America/Lima)
Rama: `develop`
SHA base: `e534c1b4f41f61a00cb11afe8983d18b9aadd413`

## Resumen

Se unificó la experiencia de navegación de los portales privados con un shell compartido: identidad DentaIA, navegación agrupada por rol, indicadores activos, encabezado contextual, identidad del usuario, enlace a la cuenta y cierre de sesión. En móvil la navegación pasa a un drawer con cierre explícito, fondo de cierre, Escape y retorno del foco al botón que lo abre. El drawer cerrado queda fuera de la navegación accesible.

`/cuenta` conserva su URL. Para visitantes mantiene el acceso público; con rol autorizado presenta el portal privado. La página muestra iniciales, nombre, correo, rol y un formulario compacto, manteniendo las operaciones y mensajes existentes.

El panel del paciente incorpora saludo, tarjetas de métricas basadas en los datos disponibles, accesos visuales y errores clínicos compactos. El portal profesional reutiliza la navegación común y presenta de forma más clara estados y contexto clínico. La administración mantiene sus protecciones y operaciones existentes, con identidad del usuario, roles y estados más legibles.

No se modificaron APIs, llamadas de Supabase, roles, guards, controles MFA/AAL2, JWT, RLS, consentimientos, migraciones, datos remotos, configuración de Vercel ni contenido comercial de la landing.

## Componentes y archivos

Se añadió `TarjetaMetrica` y se mejoraron `PortalShell` e `Identidad`. También se ajustaron los layouts de paciente y odontólogo, las vistas de cuenta, panel de paciente, portal profesional y panel administrativo, además de sus estilos CSS. La ruta `/cuenta` se movió del grupo público al segmento raíz conservando la misma URL.

Archivos cambiados respecto a la base:

- `src/app/(odontologo)/layout.tsx`
- `src/app/(paciente)/layout.tsx`
- `src/app/cuenta/page.tsx` (movida desde `src/app/(public)/cuenta/page.tsx`)
- `src/components/Identidad.tsx`
- `src/components/PortalShell.tsx`
- `src/components/TarjetaMetrica.tsx` (nuevo)
- `src/components/portal-shell.module.css`
- `src/components/tarjeta-metrica.module.css` (nuevo)
- `src/features/administracion/EncabezadoAdministrativo.tsx`
- `src/features/administracion/LayoutAdministrativo.tsx`
- `src/features/administracion/UsuariosAdministrativos.tsx`
- `src/features/administracion/administracion.module.css`
- `src/features/cuenta/Cuenta.tsx`
- `src/features/cuenta/cuenta.module.css`
- `src/features/panel/PanelPaciente.tsx`
- `src/features/panel/ResumenPanel.tsx`
- `src/features/panel/panel.module.css`
- `src/features/profesional/ProfesionalClinico.tsx`
- `src/features/profesional/profesional.module.css`

## Verificaciones

- `npm run typecheck`: aprobado.
- `npm run build`: aprobado; Next.js compiló y generó las rutas, incluida `/cuenta`, `/panel`, `/profesional`, `/administracion` y las APIs existentes.
- Suite automatizada (`node --experimental-strip-types --test` sobre los archivos `*.test.mjs` de `src`): 402 aprobadas, 0 fallidas, 0 omitidas.
- `git diff --check`: aprobado.
- Inspección visual del navegador local: `/panel` en 1440, 1280, 768 y 390 px; `/profesional` en escritorio; `/cuenta` en móvil de 390 px. No se observó desbordamiento horizontal en las vistas verificadas.
- Menú móvil: apertura, cierre con botón y Escape; el foco vuelve al control de apertura.

La interfaz local no tenía una sesión autenticada con datos clínicos. En paciente y profesional se observó el estado no autenticado/error correspondiente; no se verificaron datos reales, permisos contra Supabase ni el contenido de un panel con sesión activa. No se ejecutaron pruebas E2E contra Supabase o Vercel. Administración compiló y pasó la suite, pero su ruta no se inspeccionó visualmente en navegador. No se guardaron capturas persistentes; la revisión se hizo en la ventana del navegador.

La inspección de responsive y foco fue manual; no se ejecutó un auditor automatizado de accesibilidad ni se certificó contraste con herramienta especializada.

## Commits locales

1. `7377f99 refactor: unificar navegación de portales privados`
2. `ada1984 style: rediseñar cuenta y dashboard del paciente`
3. `6effe98 style: modernizar paneles clínico y administrativo`

Los commits están en `develop` sobre la base indicada. No se publicaron.

## Pendientes

- Revisar visualmente administración con un entorno autenticado autorizado.
- Repetir la revisión funcional visual con sesiones autorizadas de paciente y odontólogo para confirmar datos y estados reales.
- Ejecutar E2E contra los servicios configurados cuando exista un entorno seguro con cuentas sintéticas autorizadas.
- Si se requieren evidencias compartibles, capturar y almacenar screenshots sin información sensible.
