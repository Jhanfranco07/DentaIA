# Integración de Pagos con Stripe (Sandbox)

## 1. Objetivo y Alcance
Este documento detalla la configuración y arquitectura del flujo de pagos en entorno de pruebas para la plataforma.

## 2. Simulación de Pagos
Todas las transacciones se ejecutan estrictamente en modo prueba (Test Mode). No se procesan cargos reales ni se utiliza dinero real.

## 3. Creación del Sandbox y Claves
1. Crear cuenta en Stripe y activar el modo Test Mode en el dashboard.
2. Ir a Developers > API keys y copiar la clave publicable (pk_test_...) y la clave secreta (sk_test_...).

## 4. Instalación de Stripe CLI en Windows
Ejecutar en PowerShell: winget install Stripe.StripeCLI

## Tabla `payments`
| Columna | Descripción |
|---|---|
| user_id | Usuario de Supabase que pagó |
| stripe_session_id | Sesión de Checkout (única) |
| stripe_event_id | Evento del webhook (único, evita duplicados) |
| plan, amount_total, currency | Plan y monto en centavos |
| status | paid, unpaid o expired |

RLS activo: cada usuario solo lee sus pagos. Solo el servidor escribe.


## Endpoint `POST /api/stripe/checkout`
- Requiere el encabezado `Authorization: Bearer <access_token de Supabase>`.
- 401 si no hay sesión válida. 502 si Stripe falla.
- Respuesta correcta: `{ "url": "https://checkout.stripe.com/..." }`.
