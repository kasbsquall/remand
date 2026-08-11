# Entrega · Hackathon Ethereum Lima 2026 · track Arbitrum

**Remand · La segunda instancia del crédito on-chain**
Bounty: Advanced (Scaffold-Stylus + AI)

---

## Enlaces

| Qué | Dónde |
|---|---|
| Repositorio | https://github.com/kasbsquall/remand |
| Demo en vivo | https://remand.107-172-6-206.sslip.io |
| Verificador público | https://remand.107-172-6-206.sslip.io/verify |
| Registro de fallos | https://remand.107-172-6-206.sslip.io/registro |
| Contrato en Arbiscan | https://sepolia.arbiscan.io/address/0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a |
| Atestador de estado | https://sepolia.arbiscan.io/address/0xce27abc23d456b2dce24967b669624569c396448 |
| Fallo asentado (transacción) | https://sepolia.arbiscan.io/tx/0x076b29b19e3d18eee39c44a7d0e93490cfe0255333634016328a7a985ecc7757 |
| Video pitch | https://youtu.be/8-E8ES9ZZDQ |
| Video demo | https://youtu.be/TWz0m-Wgoqw |
| Arquitectura | [docs/ARCHITECTURE.md](ARCHITECTURE.md) |
| Contratos | [docs/CONTRACTS.md](CONTRACTS.md) |
| Pitch deck (PDF) | [docs/deck/remand-pitch-deck.pdf](deck/remand-pitch-deck.pdf) |

## Archivos de vídeo

| Pieza | Duración | Enlace | Formato |
|---|---|---|---|
| Video pitch | 2:37 | https://youtu.be/8-E8ES9ZZDQ | 1920×1080 · 30 fps · −15,2 LUFS |
| Video demo | 2:15 | https://youtu.be/TWz0m-Wgoqw | 1920×1080 · 30 fps · sin locución, una sola toma |

Los dos salen en `yuv420p` con `color_range=tv` y bt709. Sin esa conversión
explícita los reproductores que ignoran la etiqueta expanden el rango igual y
todo lo que pasa de 235 se quema a blanco.

---

## Qué mirar primero, si sólo hay dos minutos

Abrir el verificador, cambiar el campo **Repagos** de `3` a `1` y volver a
consultar. El puntaje cae de 63,75% a 43,75% y el sello vira a NO COINCIDE. Un
valor guardado no reacciona a un input nuevo; ese sí, y eso es lo único que
demuestra que hay aritmética dentro del contrato.

Lo mismo desde una terminal, sin wallet, sin gas y sin pasar por este servidor:

```bash
cast call 0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a \
  "previewVerdict(uint32,uint32,uint32,uint32,uint32,uint32,uint32)(uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32)" \
  900 3 30 3 3 2 5 --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

Devuelve `10000 · 1000 · 10000 · 3334 · 6250 · 6375 · true · 8175`.

---

## El atestador de estado

Un segundo contrato, en `0xce27abc23d456b2dce24967b669624569c396448`, demuestra hechos de la cadena en vez de
aceptarlos. Recibe la cabecera de un bloque, comprueba su keccak contra el
precompilado ArbSys de la propia cadena, y verifica pruebas de Merkle-Patricia
contra la raíz de estado que lleva dentro.

Con eso lee el nonce de una cuenta ajena, que es algo que ningún opcode del EVM
puede hacer. La llamada es de lectura pura: sin gas y sin firma.

El expediente lo usa para separar sus siete campos en probados, recalculables y
declarados, y para comprobar una cota que la cadena puede desmentir: una wallet
no puede haber hecho más operaciones que transacciones ha firmado.

Transacción de despliegue: 0x52c9616516a84323e9687b6134e93e419bd5b9da11f47021c09eaa1322323c6b

## Declaraciones de honestidad

Van también en el producto y en el vídeo, no sólo aquí.

- **El contrato está desplegado en Arbitrum Sepolia, red de pruebas.** La
  evidencia sí se lee de **Arbitrum One**, la red real, del pool de Aave V3.
- **La instancia pública corre sin clave de modelo**, así que los alegatos se
  redactan por regla determinista y la propia interfaz lo rotula. El fallo sale
  idéntico en los dos casos, porque lo computa el contrato y no el redactor.
- **El mecanismo exige historial previo.** Hoy Remand sirve a quien ya pudo
  sobrecolateralizar y le libera capital inmovilizado. No alcanza a quien nunca
  pudo depositar, y eso está declarado en el producto, en el deck y en el vídeo.
- **El anclaje sin confianza alcanza 256 bloques**, unos 64 segundos en Arbitrum
  One, así que cubre el estado reciente y no el historial de hace meses. Cuatro de
  los siete campos del expediente siguen siendo declarados, y la interfaz lo dice.
- **El conteo de préstamos y repagos puede venir truncado** por los límites de
  la fuente. Cuando pasa, la interfaz lo marca como piso y no como valor exacto.

---

## Verificación de cifras

Cada número que aparece en el vídeo y en el deck está contrastado contra la
cadena. Para repetirlo:

```bash
python3 scripts/verificar-cifras.py
```

Comprueba 19 cifras contra `previewVerdict`, `getRuling` y el recibo de la
transacción, incluidas las derivadas que ninguna llamada devuelve, como los
817,50 sobre mil USDC o la suma de los cinco aportes.
