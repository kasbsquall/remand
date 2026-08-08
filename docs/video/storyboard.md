# Remand · Video Pitch · versión 2

Reescrito tras el jurado simulado. Cuatro evaluadores agnósticos: ingeniero senior,
inversor, espectador no técnico y jurado del track Arbitrum.

**Runtime nominal: 2:40.** Límite del reglamento: 3:00. El margen de veinte segundos es
deliberado: la locución en español se estira y el corte se mide sobre el audio real, no
sobre esta tabla.

**Frase pegajosa**, tres apariciones: 0:08, 1:38, 2:32.
**"No tienes que confiar en Remand. Puedes comprobarlo."**

---

## Qué cambió y por qué

| Crítica | De quién | Corrección |
|---|---|---|
| 42 s de problema antes de decir qué hacemos | los cuatro | La tesis y el beneficio en dinero entran en el segundo 8 |
| "Colateral" y "on-chain" nunca se explican | espectador lego | Se explican con dinero y con una imagen, sin usar la palabra |
| `getRuling` lee storage, no prueba cómputo | ingeniero | La prueba pasa a `previewVerdict`, función pura, contrastada contra Arbiscan |
| La prueba está mal filmada y al final | ingeniero | Sube al 1:38 y dura 28 s, la escena más larga del video |
| Cero humanos, cero clics | ingeniero e inversor | Escena 9: wallet real firmando y transacción confirmándose |
| Scaffold-Stylus no aparece nunca | jurado Arbitrum | En pantalla y en locución, escena 7 |
| Si borro los agentes el número no cambia | jurado Arbitrum | La escena 5 muestra que los agentes construyen el expediente que entra al contrato |
| El gas no tiene escala | inversor y jurado Arbitrum | Sale de la locución. Queda en pantalla con su comparación |
| El impacto lo desmiente el mecanismo | inversor | Reposicionado: liberamos capital inmovilizado. La inclusión se declara como horizonte |
| Las marcas de tiempo no cuadran | ingeniero y jurado Arbitrum | Esta tabla se deriva de las escenas, no se escribe aparte |

---

## Afirmación y prueba

| Afirmación | Prueba en pantalla | Escena | Entra |
|---|---|---|---|
| Te rechazan y no hay a quién reclamar | Sello DENEGADA | 1 | 0:00 |
| Dejas 1.200 para recibir 1.000 | Cifras contrapuestas, captura real | 2 | 0:10 |
| Los demás calculan en un servidor privado | Spectral, Cred, RociFi nombrados | 3 | 0:26 |
| Leemos historial real, no declarado | Expediente cargando con la huella | 4 | 0:38 |
| Los agentes construyen el expediente | El payload formándose y entrando al contrato | 5 | 0:56 |
| El contrato falla, no el modelo | Acta sumando a la vista | 6 | 1:08 |
| Stylus y Scaffold-Stylus | Terminal de `cargo stylus` y árbol del repo | 7 | 1:24 |
| **Cualquiera reproduce el cómputo** | **Función pura vía RPC + Read Contract de Arbiscan** | **8** | **1:38** |
| Se asienta en la cadena | Wallet real firmando, hash confirmado | 9 | 2:06 |
| Sabemos hasta dónde llega | Límites y horizonte declarados | 10 | 2:18 |
| Pruébalo tú | URL y QR sostenidos | 11 | 2:28 |

---

## Escenas

### 1 · Apertura en frío · 0:00 → 0:10 · 10 s

**Imagen.** Negro. Una línea en mono: `Solicitud · 1.000 USDC`. Latido. El sello **DENEGADA**
cae con su rotación y doble filete. Golpe de tampón. Todo quieto.
Corte seco a: `1.000 recibidos · 1.200 inmovilizados`, las dos cifras enfrentadas.

**Locución.** "Para que te presten mil dólares en cripto, tienes que dejar mil doscientos
guardados. Si no los tienes, te rechazan. Y no hay a quién reclamarle."

---

### 2 · La tesis y el dinero · 0:10 → 0:26 · 16 s

**Imagen.** El monograma se dibuja. Debajo, el número que importa creciendo dígito a dígito:
**1.200 → 810**. Al costado, en pequeño: *misma wallet, mismo préstamo*.

**Locución.** "Remand es la segunda instancia. Reabre tu caso, mira cómo te has portado de
verdad, y recalcula cuánto te tienen que exigir. En este expediente real, de mil doscientos
baja a ochocientos diez. No tienes que confiar en Remand. Puedes comprobarlo."

---

### 3 · Por qué hoy no puedes reclamar · 0:26 → 0:38 · 12 s

**Imagen.** Tres nombres entrando: Spectral Finance, Cred Protocol, RociFi. Sobre ellos, una
caja gris cerrada con un candado, y el resultado saliendo por un lado sin que se vea el
interior.

**Locución.** "Ya hay quien evalúa riesgo para prestar sin tanta garantía. Todos calculan tu
puntaje en un servidor privado y solo publican el resultado. No puedes rehacer la cuenta, y
no puedes discutirla."

---

### 4 · La evidencia · 0:38 → 0:56 · 18 s

**Imagen.** Grabación real del expediente cargando. La huella se dibuja: la aguja de
antigüedad corriendo al tope, el peine entintando meses, las barras de préstamos y repagos,
las muescas rojas de las liquidaciones. Rótulo en esquina: *leído de Arbitrum One, red real*.

**Locución.** "Remand no te pregunta nada. Lee lo que ya hiciste: cuántos préstamos pediste,
cuántos devolviste, hace cuánto operas, si alguna vez te liquidaron. Sale del registro
público de Aave, donde nadie lo puede maquillar."

---

### 5 · Los agentes · 0:56 → 1:08 · 12 s

**Imagen.** Dos columnas breves, una frase legible en cada una. Luego ambas colapsan en un
**payload de siete números** que se forma en pantalla y viaja hacia el contrato. La cámara lo
sigue.

**Locución.** "Dos agentes trabajan el caso: uno arma tu defensa, otro la audita y la
cuestiona. Ninguno de los dos dicta el fallo. Construyen el expediente sobre el que el
contrato falla."

---

### 6 · El fallo · 1:08 → 1:24 · 16 s

**Imagen.** El acta. Cada fila con su folio. La columna de aportes suma a la vista. El total
crece dígito a dígito hasta **63,75%**. El sello CONCEDIDA cae.

**Locución.** "El fallo lo computa un contrato. Cinco dimensiones, cada una con su peso, y la
suma a la vista para que cualquiera la rehaga. Esta wallet pasa con sesenta y tres coma
setenta y cinco."

---

### 7 · Stylus · 1:24 → 1:38 · 14 s

**Imagen.** Terminal real: `cargo stylus check` devolviendo el tamaño. Corte al árbol del
repositorio mostrando `packages/stylus` sobre **Scaffold-Stylus**. Rótulos con las cifras y su
comparación al lado.

**Locución.** "Ese cálculo dentro de un contrato normal saldría caro, y por eso todos los
demás lo hacen fuera. Lo escribimos en Rust con Arbitrum Stylus, sobre Scaffold-Stylus, y
cabe entero en la cadena."

---

### 8 · La prueba · 1:38 → 2:06 · 28 s

La escena más larga del video, y la única razón por la que merece ganar.

**Imagen, en tres tiempos.**
Primero: el verificador con los siete números crudos. Se llama a **`previewVerdict`**, función
pura, sin firma y sin gas. Sale 63,75. Rótulo: *el contrato calcula, no consulta un dato
guardado*.
Segundo: pantalla partida. A la izquierda nuestra página. A la derecha el **Read Contract de
Arbiscan**, que no es nuestro, con la misma llamada y el mismo resultado. Sello **COINCIDE**.
Tercero: una mano cambia los repagos de 3 a 1. El puntaje cae a 43,75. El sello vira a
**NO COINCIDE**. Se subraya qué dimensión se movió.

**Locución.** "Y esto es lo que ningún otro te da. Aquí no te enseño un número guardado: le
paso los datos crudos al contrato y él los calcula delante de ti, gratis y sin firmar nada.
Lo mismo desde Arbiscan, que no es nuestro. Y si cambio un dato, el fallo cambia. Eso es lo
que demuestra que hay aritmética adentro y no una promesa."

---

### 9 · Se asienta · 2:06 → 2:18 · 12 s

**Imagen.** Grabación real: wallet conectándose, botón de asentar, MetaMask abriéndose, firma,
y el hash apareciendo confirmado en Arbiscan. Sin cortes.

**Locución.** "Cuando el apelante firma, el fallo queda asentado con su desglose completo.
A partir de ahí ya no depende de nosotros ni de que esta página exista."

---

### 10 · Hasta dónde llega · 2:18 → 2:28 · 10 s

**Imagen.** El bloque de alcance de la evidencia, tal como está en el producto.

**Locución.** "Hoy leemos Aave, así que servimos a quien ya operó y le liberamos capital
inmovilizado. Llegar a quien nunca pudo depositar exige señales que no pidan garantía previa,
y ese es el siguiente trabajo del motor."

---

### 11 · Cierre · 2:28 → 2:40 · 12 s

**Imagen.** La roseta guilloche dibujándose. Logotipo apilado. URL en grande y QR al costado,
sostenidos los últimos cinco segundos.

**Locución.** "Remand. No tienes que confiar en nosotros. Puedes comprobarlo."

---

## Declaraciones de honestidad en pantalla

| Texto | Dónde |
|---|---|
| leído de Arbitrum One, red real | escena 4, esquina |
| contrato desplegado en Arbitrum Sepolia, red de pruebas | escena 7, esquina |
| consulta hecha desde el navegador, sin servidor intermedio | escena 8, bajo la pantalla partida |

---

## Cifras y su fuente

| Cifra | Fuente | Verificable en |
|---|---|---|
| 1.200 sobre 1.000 | parámetros de Aave V3 | documentación del protocolo |
| 63,75% y 810 sobre 1.000 | `previewVerdict` con la evidencia del expediente | llamada pública al contrato |
| 43,75% al bajar repagos a 1 | misma función, input modificado | en pantalla, escena 8 |
| 12,2 KB | salida de `cargo stylus check` | terminal en escena 7 |
| 900 días, 3 de 30 meses, 3 préstamos, 3 repagos, 2 liquidaciones, 5 contratos | recolector sobre `0x39c7e5be` | Arbiscan |

**Regla:** ninguna cifra entra al video sin fuente en esta tabla. El gas sale de la locución
porque no tiene escala para quien mira; queda en pantalla junto a su comparación.
