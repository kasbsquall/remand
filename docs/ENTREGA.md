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
| Fallo asentado (transacción) | https://sepolia.arbiscan.io/tx/0x076b29b19e3d18eee39c44a7d0e93490cfe0255333634016328a7a985ecc7757 |
| Arquitectura | [docs/ARCHITECTURE.md](ARCHITECTURE.md) |
| Contratos | [docs/CONTRACTS.md](CONTRACTS.md) |
| Pitch deck (PDF) | [docs/deck/remand-pitch-deck.pdf](deck/remand-pitch-deck.pdf) |

## Archivos de vídeo

| Pieza | Duración | Formato |
|---|---|---|
| Video pitch | 2:37 | 1920×1080 · 30 fps · −15,2 LUFS |
| Video demo | 2:15 | 1920×1080 · 30 fps · sin locución, una sola toma |
| Miniatura | — | 1920×1080 JPG |

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
