"""Contrasta cada cifra que el video pone en pantalla contra la cadena.

No es una revisión de estilo: es la comprobación que ya encontró dos errores en
este proyecto. La primera vez, un colateral de 810 que el contrato nunca
devolvió. La segunda, una promesa de captura de Arbiscan que no existía.

Cada fila declara qué se afirma y de dónde tiene que salir. Si una no cuadra, se
imprime y el video no se entrega así.
"""
import json
import subprocess
import sys
import urllib.request

RPC = "https://sepolia-rollup.arbitrum.io/rpc"
ONE = "https://arb1.arbitrum.io/rpc"
CONTRATO = "0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a"
ATESTADOR = "0xce27abc23d456b2dce24967b669624569c396448"
APELANTE = "0x39c7e5be19f99b178e38aa06f7799d517be89e92"
TX = "0x076b29b19e3d18eee39c44a7d0e93490cfe0255333634016328a7a985ecc7757"
FIRMA = "previewVerdict(uint32,uint32,uint32,uint32,uint32,uint32,uint32)"


def cast(args):
    r = subprocess.run(["cast", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"cast falló: {r.stderr.strip()[:200]}")
    return r.stdout.strip()


def rpc(url, metodo, params):
    """Llamada JSON-RPC cruda, para lo que cast no cubre."""
    # El nodo publico de Arbitrum One devuelve 403 al user-agent de urllib.
    cab = {"content-type": "application/json", "user-agent": "curl/8.5.0"}
    cuerpo = json.dumps({"jsonrpc": "2.0", "id": 1, "method": metodo,
                         "params": params}).encode()
    pet = urllib.request.Request(url, cuerpo, cab)
    d = json.loads(urllib.request.urlopen(pet, timeout=40).read())
    if "error" in d:
        raise SystemExit(f"{metodo}: {d['error']}")
    return d["result"]


def preview(repagos):
    """Los siete campos del expediente, con los repagos como variable."""
    out = cast([
        "call", CONTRATO,
        f"{FIRMA}(uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32)",
        "900", "3", "30", str(repagos), "3", "2", "5",
        "--rpc-url", RPC,
    ])
    # cast imprime cada valor en su línea, algunos con la notación [1e4].
    vals = []
    for linea in out.splitlines():
        t = linea.split("[")[0].strip()
        if t in ("true", "false"):
            vals.append(t == "true")
        elif t:
            vals.append(int(t))
    return vals


fallos = []


def comprobar(afirmacion, esperado, obtenido):
    ok = esperado == obtenido
    marca = "ok  " if ok else "MAL "
    print(f"  {marca} {afirmacion:<52} espera {esperado!s:<10} obtiene {obtenido}")
    if not ok:
        fallos.append(afirmacion)


print("== expediente del video · 900 3 30 3 3 2 5 ==")
v = preview(3)
comprobar("escena 6 · puntaje total 63,75%", 6375, v[5])
comprobar("escena 6 · concedida", True, v[6])
comprobar("escena 2 · colateral 81,75%", 8175, v[7])
comprobar("escena 6 · historial de repago bruto 100,00", 10000, v[0])
comprobar("escena 6 · constancia bruto 10,00", 1000, v[1])
comprobar("escena 6 · antiguedad bruto 100,00", 10000, v[2])
comprobar("escena 6 · liquidaciones bruto 33,34", 3334, v[3])
comprobar("escena 6 · diversidad bruto 62,50", 6250, v[4])

print("\n== mismo expediente con un solo repago ==")
w = preview(1)
comprobar("escena 8 · puntaje cae a 43,75%", 4375, w[5])
comprobar("escena 8 · denegada", False, w[6])
comprobar("deck · repago bruto cae a 33,33", 3333, w[0])
comprobar("deck · colateral sube a 93,75%", 9375, w[7])

print("\n== derivadas que el video imprime pero la cadena no ==")
colat_pct = v[7] / 100
sobre_mil = colat_pct * 10
comprobar("escena 2 · 817,50 sobre 1.000 USDC", 817.5, round(sobre_mil, 2))
comprobar("escena 2 · 382,50 liberados", 382.5, round(1200 - sobre_mil, 2))
aportes = [30.00, 2.50, 20.00, 5.00, 6.25]
comprobar("escena 6 · los cinco aportes suman el total", 63.75, round(sum(aportes), 2))

print("\n== atestador · escena 9 ==")
# La escena 9 afirma que un contrato lee el nonce de una cuenta ajena sin
# oraculo. Se comprueba pidiendo la prueba de estado a un nodo de Arbitrum One y
# entregandosela al atestador: si su recorrido del trie llega al mismo nonce que
# el nodo declara por su cuenta, la afirmacion se sostiene.
#
# El bloque no puede ser el que sale en pantalla. El anclaje sin confianza
# alcanza 256 bloques, asi que aquel ya expiro y hay que traer uno fresco. Eso
# no debilita la comprobacion: lo que se verifica es el mecanismo, y el
# mecanismo es el mismo en cualquier bloque.
tope = int(rpc(ONE, "eth_blockNumber", []), 16)
# La punta menos cuatro, porque los nodos publicos podan el estado en la cabeza
# de la cadena y eth_getProof falla si se les pide el ultimo.
bloque = hex(tope - 4)
raiz = rpc(ONE, "eth_getBlockByNumber", [bloque, False])["stateRoot"]
prueba = rpc(ONE, "eth_getProof", [APELANTE, [], bloque])
nodos = prueba["accountProof"]

leido = cast([
    "call", ATESTADOR,
    "previewAccount(bytes32,address,bytes[])(uint64,uint256,bytes32,bytes32)",
    raiz, APELANTE, "[" + ",".join(nodos) + "]", "--rpc-url", RPC,
]).splitlines()[0].split("[")[0].strip()

comprobar("escena 9 · el atestador lee 19 transacciones firmadas", 19, int(leido))
comprobar("escena 9 · su recorrido del trie coincide con el nodo",
          int(prueba["nonce"], 16), int(leido))
print(f"       la prueba de este bloque trae {len(nodos)} nodos; en pantalla se ve "
      f"la del bloque grabado, que ya cayo fuera de la ventana de 256")

print("\n== asiento en la cadena · escena 10 ==")
recibo = json.loads(cast(["receipt", TX, "--rpc-url", RPC, "--json"]))
comprobar("escena 10 · transaccion exitosa", 1, int(recibo["status"], 16))
comprobar("escena 10 · bloque 295922360", 295922360, int(recibo["blockNumber"], 16))
comprobar("deck · gas 95.806", 95806, int(recibo["gasUsed"], 16))
comprobar("escena 10 · destino es nuestro contrato", CONTRATO, recibo["to"].lower())

print()
if fallos:
    print(f"{len(fallos)} cifra(s) sin respaldo:")
    for f in fallos:
        print("   -", f)
    sys.exit(1)
# Se dice exactamente lo que se comprobo. Afirmar "todas las cifras del video"
# seria pasarse: el numero de bloque que aparece en la escena 9 pertenece a una
# grabacion cuyo anclaje ya expiro, y eso no se puede volver a verificar.
print("las cifras del fallo, del atestador y del asiento cuadran con la cadena")
