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

RPC = "https://sepolia-rollup.arbitrum.io/rpc"
CONTRATO = "0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a"
TX = "0x076b29b19e3d18eee39c44a7d0e93490cfe0255333634016328a7a985ecc7757"
FIRMA = "previewVerdict(uint32,uint32,uint32,uint32,uint32,uint32,uint32)"


def cast(args):
    r = subprocess.run(["cast", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"cast falló: {r.stderr.strip()[:200]}")
    return r.stdout.strip()


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

print("\n== asiento en la cadena ==")
recibo = json.loads(cast(["receipt", TX, "--rpc-url", RPC, "--json"]))
comprobar("escena 9 · transaccion exitosa", 1, int(recibo["status"], 16))
comprobar("escena 9 · bloque 295922360", 295922360, int(recibo["blockNumber"], 16))
comprobar("deck · gas 95.806", 95806, int(recibo["gasUsed"], 16))
comprobar("escena 9 · destino es nuestro contrato", CONTRATO, recibo["to"].lower())

print()
if fallos:
    print(f"{len(fallos)} cifra(s) sin respaldo:")
    for f in fallos:
        print("   -", f)
    sys.exit(1)
print("todas las cifras del video y del deck cuadran con la cadena")
