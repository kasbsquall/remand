# Software de terceros

El reglamento del track permite usar frameworks, SDKs, APIs, modelos de IA y
librerías de código abierto, siempre que se respeten sus licencias, se cite su
uso, y sean herramientas de apoyo y no el producto completo. Este documento
cumple esa cita.

## Base del proyecto

| Componente | Uso | Licencia |
|---|---|---|
| [Scaffold-Stylus](https://github.com/Arb-Stylus/scaffold-stylus) | Estructura del monorepo, scripts de despliegue y conexión del frontend con el contrato. Requisito del bounty Advanced | MIT |

## Contrato

| Componente | Versión | Uso | Licencia |
|---|---|---|---|
| [Stylus SDK](https://github.com/OffchainLabs/stylus-sdk-rs) | 0.9.0 | Escribir el contrato en Rust y compilarlo a WebAssembly | Apache-2.0 / MIT |
| [cargo-stylus](https://github.com/OffchainLabs/cargo-stylus) | 0.10.8 | Verificar, activar y desplegar el contrato | Apache-2.0 / MIT |
| [alloy-primitives](https://github.com/alloy-rs/core) | 0.8.20 | Tipos primitivos de Ethereum en Rust | MIT / Apache-2.0 |
| [alloy-sol-types](https://github.com/alloy-rs/core) | 0.8.20 | Codificación ABI y definición de eventos y errores | MIT / Apache-2.0 |

El motor de veredicto (`verdict_engine.rs`) y el esquema de evidencia
(`evidence_schema.rs`) son código propio, sin dependencias más allá del núcleo
de Rust.

## Aplicación

| Componente | Versión | Uso | Licencia |
|---|---|---|---|
| [Next.js](https://nextjs.org) | 16 | Framework de la aplicación y rutas de servidor | MIT |
| [React](https://react.dev) | 19 | Interfaz | MIT |
| [viem](https://viem.sh) | 2.39 | Lectura del contrato desde servidor y navegador | MIT |
| [wagmi](https://wagmi.sh) | 2.19 | Conexión de wallet, heredado de Scaffold-Stylus | MIT |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Utilidades de maquetación | MIT |
| [Phosphor Icons](https://phosphoricons.com) | 2.1 | Iconografía, peso Light | MIT |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | 0.115 | Cliente de los dos agentes | MIT |

## Tipografías

| Familia | Uso | Licencia |
|---|---|---|
| [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) | Logotipo y titulares | SIL Open Font License 1.1 |
| [Newsreader](https://fonts.google.com/specimen/Newsreader) | Texto corrido | SIL Open Font License 1.1 |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | Cifras y datos tabulares | SIL Open Font License 1.1 |

Las tres se sirven desde el propio despliegue mediante `next/font`, no desde un
CDN externo.

## Servicios externos

| Servicio | Uso | Modelo |
|---|---|---|
| [Etherscan API v2](https://docs.etherscan.io) | Historial de transacciones y eventos de préstamo de una wallet en Arbitrum One | Plan gratuito, requiere clave |
| [Claude](https://www.anthropic.com) | Redacción de los alegatos del Defensor y de la Contraparte | API de pago, opcional |
| RPC público de Arbitrum | Lectura del contrato desplegado | Gratuito |
| [Let's Encrypt](https://letsencrypt.org) | Certificado TLS de la demo | Gratuito |

**Sobre el modelo de lenguaje.** Es una herramienta de apoyo y no el producto. No
computa el fallo ni influye en él: redacta los argumentos del expediente a
partir de la evidencia ya recolectada. Si el servicio no está disponible, la
aplicación arma el expediente con un análisis determinista y lo declara en
pantalla.

## Datos leídos de la cadena

| Fuente | Qué se lee |
|---|---|
| [Aave V3 Pool en Arbitrum One](https://arbiscan.io/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD) | Eventos `Borrow`, `Repay` y `LiquidationCall` de la wallet apelante |

Los tres identificadores de evento se verificaron calculando el keccak de sus
firmas, no copiándolos de una referencia.

## Herramientas de desarrollo

| Herramienta | Uso |
|---|---|
| [Foundry](https://getfoundry.sh) | `cast` para consultar el contrato y verificar firmas de evento |
| [solc](https://soliditylang.org) | Compilador requerido por Scaffold-Stylus |
| [Docker](https://www.docker.com) | Empaquetado de la aplicación para el despliegue |
| [Playwright](https://playwright.dev) | Verificación visual de la interfaz durante el desarrollo |
| [Claude Code](https://claude.com/claude-code) | Asistencia de programación durante toda la hackathon |
