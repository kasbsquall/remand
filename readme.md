<div align="center">

<img src="packages/nextjs/public/remand-mark.svg" width="72" alt="">

# Remand

**La segunda instancia del crédito on-chain**

Si te niegan un préstamo, tu caso se reabre con evidencia y el fallo se recalcula
dentro de un contrato en Arbitrum. Verificable por cualquiera.

[Demo en vivo](https://remand.107-172-6-206.sslip.io) ·
[Video](https://youtu.be/8-E8ES9ZZDQ) ·
[Contrato en Arbiscan](https://sepolia.arbiscan.io/address/0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a) ·
[Arquitectura](docs/ARCHITECTURE.md) ·
[Contratos](docs/CONTRACTS.md)

</div>

---

## Entregables

| Pieza | Dónde |
|---|---|
| Demo en producción | [remand.107-172-6-206.sslip.io](https://remand.107-172-6-206.sslip.io) |
| Contrato del fallo | [`0xC6af1f28…97E2850A`](https://sepolia.arbiscan.io/address/0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a) en Arbitrum Sepolia |
| Fallo asentado | [`0x076b29b1…cc7757`](https://sepolia.arbiscan.io/tx/0x076b29b19e3d18eee39c44a7d0e93490cfe0255333634016328a7a985ecc7757), bloque 295922360 |
| Video pitch | [Ver en YouTube](https://youtu.be/8-E8ES9ZZDQ) · 2:37 |
| Video demo | [Ver en YouTube](https://youtu.be/TWz0m-Wgoqw) · 2:15 · una sola toma, sin cortes |
| Pitch deck | [`docs/deck/remand-pitch-deck.pdf`](docs/deck/remand-pitch-deck.pdf) |
| Arquitectura | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |

## Comprobarlo sin fiarte de nada de esto

El argumento entero del proyecto es que el cálculo se puede repetir sin pedirnos
permiso. Aquí está cómo, con una sola orden y sin wallet:

```bash
cast call 0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a \
  "previewVerdict(uint32,uint32,uint32,uint32,uint32,uint32,uint32)(uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32)" \
  900 3 30 3 3 2 5 --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

Devuelve `10000 · 1000 · 10000 · 3334 · 6250 · 6375 · true · 8175`. El `6375` es
el 63,75% del acta y el `8175` el colateral del 81,75%.

Baja los repagos de `3` a `1` en esa misma orden y el total cae a `4375`, el
fallo pasa a `false` y el colateral sube a `9375`. Un valor guardado no
reacciona a un input nuevo; este sí, y eso es lo que demuestra que hay
aritmética dentro del contrato y no una promesa.

Para comprobar de una vez todas las cifras que aparecen en el video y en el
deck:

```bash
python3 scripts/verificar-cifras.py
```


## El problema

El préstamo descentralizado exige sobrecolateralizar: para pedir prestado hay
que depositar más valor del que recibes, habitualmente un 120% o más. Eso
protege al protocolo y deja capital inmovilizado incluso a quien lleva años
devolviendo cada préstamo que pidió.

Ya existen protocolos que evalúan riesgo para prestar sin colateral completo.
Spectral Finance, Cred Protocol, Credora y RociFi del lado del scoring; Maple,
TrueFi y Goldfinch del lado institucional. **Todos comparten el mismo defecto
estructural: el score se calcula fuera de la cadena, en un servidor privado, y
solo se publica el resultado.** Quien recibe un rechazo no puede reproducir el
cálculo, no sabe qué dimensión lo hundió y no tiene ante quién impugnar.

En la banca tradicional, impugnar una decisión automatizada es un derecho
reconocido. En finanzas descentralizadas nunca se construyó. Te niegan y se
acabó.

### A quién sirve hoy, y a quién no

Conviene decirlo antes de que alguien lo deduzca. El puntaje se construye con
historial de préstamos en Aave V3, y para pedir en Aave hay que depositar 120%
primero. **Eso significa que Remand hoy sirve a quien ya pudo sobrecolateralizar
y le libera capital inmovilizado, no a quien nunca tuvo capital.**

Es eficiencia de capital para usuarios con historial probado, no acceso al
crédito para el desbancarizado. Llegar hasta ahí exige ponderar señales que no
requieran garantía previa: ingresos recurrentes verificables, historial en
protocolos sin colateral, atestaciones de terceros. Ese es el siguiente trabajo
del motor y no está hecho.

Lo que sí está resuelto es el mecanismo: que una decisión crediticia
automatizada pueda ser reproducida por cualquiera que la cuestione.

## Qué hace Remand

Reabre el caso y recalcula el fallo ponderando la evidencia de comportamiento
que la primera instancia ignoró. **El cálculo ocurre dentro de un contrato
Stylus y el desglose completo queda escrito en la cadena.**

| Dimensión | Peso | Qué mide |
|---|---|---|
| Historial de repago | 30% | Proporción de préstamos devueltos |
| Consistencia de actividad | 25% | Meses con actividad sobre meses desde el inicio |
| Antigüedad de la wallet | 20% | Tiempo operando. Satura a los dos años |
| Ausencia de liquidaciones | 15% | Cae a cero con tres liquidaciones |
| Diversidad de contratos | 10% | Contratos distintos usados. Satura en ocho |

Umbral de aprobación: 60%. El colateral exigido interpola entre el 120% de la
primera instancia y el 60% que obtiene un expediente impecable.

## Un caso real, no de laboratorio

La wallet [`0x39c7e5be…89e92`](https://arbiscan.io/address/0x39c7e5be19f99b178e38aa06f7799d517be89e92)
es un prestatario auténtico de Aave V3 en Arbitrum One. Su evidencia recolectada:
900 días de antigüedad, 3 de 30 meses con actividad, 3 préstamos con 3 repagos,
2 liquidaciones y 5 contratos usados.

El fallo emitido en cadena le da **63,75%** y le concede la apelación, bajando su
colateral exigido a **81,75%**. Pasa el umbral por poco: devolvió todo lo que
pidió y lleva 900 días operando, pero arrastra dos liquidaciones y actividad muy
intermitente. El modelo lo penaliza por ello y no regala aprobaciones.

**Reproduce ese fallo tú mismo**, sin wallet, sin gas y sin permisos:

```bash
cast call 0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a \
  "previewVerdict(uint32,uint32,uint32,uint32,uint32,uint32,uint32)(uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32)" \
  900 3 30 3 3 2 5 \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

Devuelve `10000, 1000, 10000, 3334, 6250, 6375, true, 8175`, idéntico a lo que
`getRuling(1)` tiene registrado en la cadena.

## Por qué Arbitrum Stylus

Recalcular un veredicto ponderando cinco dimensiones, con validación de
coherencia, saturaciones e interpolación del colateral, es cómputo pesado. En
Solidity sería caro en gas, y **esa es exactamente la razón por la que todos los
protocolos de scoring existentes calculan fuera de la cadena**.

Stylus añade a Arbitrum una segunda máquina virtual WebAssembly, coequal a la
EVM, que ejecuta contratos en Rust con costos sustancialmente menores en
operaciones intensivas en cómputo. Eso permite que el cálculo viva dentro del
contrato y sea auditable.

Sin Stylus, Remand tendría que confiar en un servidor privado como todos los
protocolos que critica.

| Medida | Valor |
|---|---|
| Tamaño del contrato | 12,2 KB de WASM |
| Fee de activación | 0,000092 ETH |
| Gas de una apelación completa | 112.534 |
| Costo de reproducir un fallo | cero, es una vista |

## Los agentes no deciden

El Defensor construye el caso a partir de la evidencia. La Contraparte lo audita
y expone sus debilidades, para que la apelación no sea una defensa complaciente.
Corren en paralelo y **no se leen entre sí**: si la Contraparte viera el texto del
Defensor tendería a rebatirlo en vez de auditar los datos.

**Ninguno computa el fallo.** Si el veredicto saliera de un modelo de lenguaje,
dos ejecuciones con la misma evidencia podrían diferir y nadie podría reproducir
un rechazo, que es exactamente el problema que Remand denuncia.

Si el modelo no está disponible, el sistema arma el expediente con un análisis
determinista sobre los mismos números y lo declara en pantalla.

## Consumir el fallo desde otro protocolo

Remand no presta dinero. Calcula un fallo y lo deja escrito, y para que eso sirva
de algo alguien tiene que usarlo. Esta es la vía, y son cuatro lecturas que no
cuestan gas ni exigen firma.

**Antes de que exista un expediente**, para decidir con qué colateral aceptarías a
una wallet, se llama a la función pura con los siete campos de evidencia. No toca
almacenamiento, así que se puede llamar en cada solicitud sin coste:

```solidity
interface IRemandVerdict {
    function previewVerdict(
        uint32 walletAgeDays,
        uint32 activeMonths,
        uint32 totalMonths,
        uint32 repayments,
        uint32 borrows,
        uint32 liquidations,
        uint32 distinctProtocols
    ) external pure returns (
        uint32 repayment,
        uint32 consistency,
        uint32 age,
        uint32 liquidation,
        uint32 diversity,
        uint32 total,
        bool granted,
        uint32 collateralBps
    );

    function getRuling(uint256 caseId) external view returns (
        address appellant,
        uint32 repayment,
        uint32 consistency,
        uint32 age,
        uint32 liquidation,
        uint32 diversity,
        uint32 total,
        bool granted,
        uint32 collateralBps
    );

    function isJudged(uint256 caseId) external view returns (bool);

    /// Cinco ponderaciones y el umbral de aprobación, todo en puntos básicos.
    function weights() external pure returns (
        uint32 wRepayment,
        uint32 wConsistency,
        uint32 wAge,
        uint32 wLiquidation,
        uint32 wDiversity,
        uint32 approvalThreshold
    );
}
```

**Cuando ya hay un expediente asentado**, se lee su fallo y se usa el colateral
que devuelve. Lo que importa aquí es que el prestamista no tiene que confiar en
nosotros para nada: recibe el desglose completo y puede recalcularlo él mismo con
la función pura y los mismos insumos.

```solidity
function colateralExigido(uint256 caseId, uint256 monto) external view returns (uint256) {
    if (!remand.isJudged(caseId)) return (monto * 12_000) / 10_000;  // sin fallo, el 120% de siempre

    (, , , , , , , bool concedida, uint32 colateralBps) = remand.getRuling(caseId);
    if (!concedida) return (monto * 12_000) / 10_000;

    // 8175 puntos basicos son el 81,75%. El suelo del motor es 6000.
    return (monto * uint256(colateralBps)) / 10_000;
}
```

Todo va en puntos básicos porque el motor no usa coma flotante en ninguna parte.
`10_000` es el 100%, el umbral de aprobación está en `6000` y el colateral se
mueve entre `12_000` y un suelo de `6000`.

Las ponderaciones no hay que copiarlas de aquí: `weights()` las devuelve desde el
propio contrato, así que un integrador puede comprobar que no cambiaron sin
fiarse de esta documentación. Hoy devuelve `3000 · 2500 · 2000 · 1500 · 1000` para
las cinco dimensiones y `6000` de umbral.

Y desde una terminal, sin escribir un contrato:

```bash
cast call 0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a \
  "weights()(uint32,uint32,uint32,uint32,uint32,uint32)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

Conviene decir el límite. Que la vía exista no significa que nadie la esté usando:
hoy no hay ningún prestamista integrado, y conseguirlo es trabajo comercial, no
técnico. Lo que esta sección resuelve es que el día que alguien quiera hacerlo no
tenga que deducir la interfaz leyendo el contrato.


## Estructura

```
packages/
├── stylus/contracts/remand-verdict/src/
│   ├── evidence_schema.rs     qué evidencia se acepta y cuándo se rechaza
│   ├── verdict_engine.rs      motor determinista, función pura, 13 tests
│   └── lib.rs                 contrato: apelaciones, fallos, vista pública
└── nextjs/
    ├── app/                   primera instancia, expediente, verificador
    ├── components/remand/     armazón, acta del fallo, marca
    ├── lib/evidence/          recolector on-chain y por indexador
    ├── lib/agents/            Defensor y Contraparte
    └── styles/remand.css      sistema de diseño
```

## Correr el proyecto

Requiere Rust 1.91.0, `cargo-stylus` 0.10.8, Node 20 o superior y Yarn.

```bash
git clone https://github.com/kasbsquall/remand.git
cd remand
yarn install

# tests del motor de veredicto
cd packages/stylus/contracts/remand-verdict && cargo test

# la aplicación
yarn start
```

Para que el expediente reúna evidencia real hace falta una clave gratuita de la
API v2 de Etherscan en `packages/nextjs/.env.local`:

```
ETHERSCAN_API_KEY=tu_clave
ANTHROPIC_API_KEY=tu_clave   # opcional: sin ella, el análisis es determinista
```

Para desplegar el contrato, en `packages/stylus/.env`:

```
PRIVATE_KEY_SEPOLIA=0x...
ACCOUNT_ADDRESS_SEPOLIA=0x...
```

```bash
yarn deploy --network sepolia --contract remand-verdict
```

## Decisiones que vale la pena conocer

**Aritmética entera, cero punto flotante.** Todo el motor calcula en puntos base.
El redondeo del flotante depende del orden de las operaciones y de la
plataforma, así que un fallo calculado con floats no sería reproducible fuera de
la cadena.

**El motor es una función pura, separada del contrato.** No lee estado, no
consulta la hora ni sabe quién lo llama. Por eso `previewVerdict` puede exponer
exactamente el mismo cálculo como vista gratuita: el verificador no es una
reimplementación que podría divergir, es la misma función.

**Sin historial no hay mérito.** Sin préstamos previos no puntúan ni el repago ni
la ausencia de liquidaciones. La segunda regla la detectó un test durante el
desarrollo, cuando una wallet recién creada obtenía 1.500 puntos base por no
haber sido liquidada nunca.

**Lo que no se puede medir se declara.** Cada dimensión viaja con su procedencia y
los conteos truncados se marcan como tales. Un cero honesto baja el puntaje; un
número estimado rompería la promesa de reproducibilidad.

## Créditos y licencia

Construido sobre [Scaffold-Stylus](https://github.com/Arb-Stylus/scaffold-stylus).
Software de terceros documentado en [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

Hackathon Ethereum Lima 2026 · Track Arbitrum · bounty Advanced.
Kevin Soto Burgos.

MIT.
