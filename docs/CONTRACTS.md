# Contratos desplegados

## RemandVerdict

Motor determinista de recálculo del veredicto de apelación. Escrito en Rust,
compilado a WebAssembly y activado con Arbitrum Stylus.

| | |
|---|---|
| Red | Arbitrum Sepolia (chain ID 421614) |
| Dirección | `0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a` |
| Arbiscan | https://sepolia.arbiscan.io/address/0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a |
| Transacción de despliegue | [`0x8dda7b87...17ed9a`](https://sepolia.arbiscan.io/tx/0x8dda7b87d015a933bf96002e372f564d009a6690aa9b9080b2b7ee286817ed9a) |
| Tamaño del WASM | 12,2 KB |
| Fee de activación | 0,000092 ETH |

### Interfaz

| Función | Tipo | Qué hace |
|---|---|---|
| `submitAppeal(uint256,uint32×7)` | escritura | Registra la apelación y falla el expediente en el mismo acto |
| `previewVerdict(uint32×7)` | vista | Reproduce cualquier fallo sin gas ni permisos. Es el verificador público |
| `getRuling(uint256)` | vista | Devuelve el fallo registrado con su desglose completo |
| `weights()` | vista | Publica los cinco pesos y el umbral que gobiernan la decisión |
| `totalAppeals()` | vista | Apelaciones falladas |
| `isJudged(uint256)` | vista | Si un expediente ya tiene fallo |

### Pesos publicados en cadena

Leídos de `weights()` en la dirección desplegada:

| Dimensión | Peso |
|---|---|
| Historial de repago | 30,00% |
| Consistencia de actividad | 25,00% |
| Antigüedad de la wallet | 20,00% |
| Ausencia de liquidaciones | 15,00% |
| Diversidad de protocolos | 10,00% |
| **Umbral de aprobación** | **60,00%** |

## Verificación del despliegue

El motor produce los mismos resultados dentro y fuera de la cadena. Contrastado
contra los casos de los tests unitarios:

| Caso | Esperado en local | Devuelto por el contrato |
|---|---|---|
| Perfil medio `(365, 6, 12, 4, 4, 0, 2)` | 7000, aprobado, colateral 7800 | 7000, aprobado, colateral 7800 |
| Wallet vacía `(0,0,0,0,0,0,0)` | 0, rechazado, colateral 12000 | 0, rechazado, colateral 12000 |

## Expediente 1: apelación real fallada en cadena

Evidencia recolectada de la wallet `0x39c7e5be19f99b178e38aa06f7799d517be89e92`,
un prestatario auténtico de Aave V3 en Arbitrum One. Los datos no son de
laboratorio: salen de su historial real.

| Dato | Valor |
|---|---|
| Antigüedad | 900 días |
| Meses activos | 3 de 30 |
| Préstamos / repagos | 3 / 3 |
| Liquidaciones | 2 |
| Protocolos distintos | 5 |

Transacción: [`0x2e3ca1b6...da7f611`](https://sepolia.arbiscan.io/tx/0x2e3ca1b6cbd495c61f2fd28347a31240fcae5b0a48cf0d37010ade952da7f611)
· bloque 295581051 · 112.534 de gas

### Fallo emitido

| Dimensión | Puntaje |
|---|---|
| Repago | 100,00% |
| Consistencia | 10,00% |
| Antigüedad | 100,00% |
| Ausencia de liquidaciones | 33,34% |
| Diversidad | 62,50% |
| **Total** | **63,75%** |
| **Resultado** | **Aprobado** |
| **Colateral exigido** | **81,75%**, en vez del 120% de la primera instancia |

El expediente muestra por qué la apelación existe. La wallet devolvió todo lo
que pidió y lleva 900 días operando, dos señales que una evaluación basada en
saldo no registra. Pero arrastra dos liquidaciones y sólo estuvo activa 3 de 30
meses, y el fallo lo refleja: pasa el umbral por poco y conserva un colateral
del 81,75%, lejos del 60% que obtiene un expediente impecable.

### Cómo reproducir el fallo sin confiar en nadie

`previewVerdict` es una vista pura: no cuesta gas, no requiere wallet y ejecuta
exactamente el mismo motor que emitió el fallo.

```bash
cast call 0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a \
  "previewVerdict(uint32,uint32,uint32,uint32,uint32,uint32,uint32)(uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32)" \
  900 3 30 3 3 2 5 \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

Devuelve `10000, 1000, 10000, 3334, 6250, 6375, true, 8175`, idéntico a lo que
`getRuling(1)` tiene registrado en cadena.
