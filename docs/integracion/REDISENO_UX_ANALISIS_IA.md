# Estabilización UX y preparación del análisis dental

## Alcance

Implementado sobre `develop` desde `b562b72c1ab97750c082944274562fdbbea5364c`. El trabajo reorganiza la experiencia del paciente, conecta la preparación de fotografías con la galería privada existente y deja preparada la interfaz de resultados. No implementa inferencia de IA, almacenamiento de nuevos análisis ni escrituras en Supabase.

## Recorrido del paciente

- `/panel`: saludo personalizado, acciones para comenzar análisis, ver resultados, tomar o elegir fotografía, explorar odontólogos y consultar solicitudes. Conserva las métricas que ya tienen fuente real y muestra “—” para resultados aún inexistentes.
- `/analisis`: nueva ruta protegida por el layout y `AccesoRol` del portal paciente. Permite seleccionar JPEG/PNG/WebP de hasta 8 MB, validar que se pueda abrir, previsualizar, sustituir y preparar una fotografía. La cámara se solicita solo después de pulsar el control; prefiere cámara posterior y detiene las pistas al cerrar o abandonar la pantalla.
- `/fotografias`: conserva el almacenamiento privado y el consentimiento existentes. Con consentimiento activo, una imagen propia puede descargarse mediante el cliente autenticado y transferirse en memoria a `/analisis`; esta acción no crea un archivo ni una concesión nuevos.
- `/resultados`: muestra un estado vacío explícito hasta que haya análisis persistidos.
- `/analisis/demo`: sigue separado como demostración educativa, sin presentarse como análisis personal.

La fotografía preparada permanece solo en memoria del navegador y se elimina al salir de la ruta. “Analizar con IA” indica que el motor todavía no está disponible; no muestra progreso ficticio, diagnóstico, porcentajes ni resultados inventados. No existe aún un endpoint ni servicio de inferencia.

## Experiencia y módulos existentes

- La navegación del paciente agrupa Inicio, Análisis, Fotografías, Resultados, Solicitudes, Odontólogos, Guía y Perfil. Se oculta el enlace duplicado a “Mi cuenta” en la cabecera privada; `/cuenta` permanece disponible.
- Las solicitudes conservan su consulta y cancelación actuales, se presentan de forma compacta y usan confirmación en línea. Se añade el nombre profesional cuando la relación existente `dentists(name)` lo proporciona; no se confirma una solicitud automáticamente.
- El directorio conserva la consulta de perfiles activos e incorpora distrito, precio referencial, iconos y enlace al perfil cuando esos datos existen. No se crean valoraciones ni credenciales.
- Los portales de odontología y administración mantienen sus componentes y controles existentes; reciben los tokens globales de diseño. No se cambió autorización, MFA/AAL2, JWT, RLS ni backend clínico.
- La landing conserva su contenido comercial y navegación compartida, con acceso a la demostración educativa. Se retiró de la portada un flujo duplicado de carga y el código de consentimiento inválido asociado; la demostración educativa permanece en su ruta propia.

## Componentes y contratos

- `TarjetaAccion` proporciona tarjetas reutilizables de acceso rápido.
- `FotografiaPreparacionContexto` comparte temporalmente el objeto `File` entre galería y preparación, sin persistencia.
- `fotografia.ts` define validación, mensajes, restricciones de cámara y los tipos `EstadoAnalisisDental` y `ResultadoAnalisisDental` para una futura integración. No es un cliente de inferencia.
- La consulta de solicitudes reutiliza el cliente Supabase ya autenticado y la relación existente; no se agrega ni duplica un endpoint.

## Validaciones realizadas

- `npm run typecheck`: aprobado.
- `npm run build`: aprobado; Next.js generó las rutas `/analisis` y `/resultados` junto con las rutas existentes.
- Suite completa `node --experimental-strip-types --test` sobre `src/**/*.test.mjs`: 406 aprobadas, 0 fallidas, 0 omitidas.
- Revisión en navegador local: la landing cargó y se inspeccionó visualmente a 1280 px; la navegación pública y los CTA fueron visibles.
- Las pruebas unitarias añadidas cubren tipos/tamaño de imagen, archivos vacíos, errores de cámara y preferencias de constraints. No se usó una cámara física.
- No se ejecutaron flujos autenticados, concesiones ni pruebas E2E contra Supabase. El navegador disponible no permite cambiar su tamaño para probar 390/768/1440 px y no se inició sesión. La prueba responsive completa y cámara en móvil quedan pendientes.
- `git diff --check` se ejecutó antes de la documentación y no reportó errores; repetir sobre el conjunto final antes de commit.

## Limitaciones y pendientes

1. Desarrollar y conectar un motor de inferencia con revisión clínica y consentimiento específico para IA.
2. Definir almacenamiento y persistencia de resultados mediante cambios revisados de backend y políticas antes de implementarlos.
3. Ejecutar E2E con cuentas sintéticas autorizadas para verificar perfiles, consentimiento y recorrido completo.
4. Verificar cámara en dispositivos reales y revisar 390, 768, 1280 y 1440 px en navegador con viewport controlable.
5. Revisar el diseño de los portales odontológico, administrativo y perfil en sesión autenticada; este cambio no altera su lógica ni añade nuevas áreas funcionales.

No se hicieron operaciones remotas ni se accedió a información clínica real.
