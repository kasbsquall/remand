import { createPublicClient, http, type Address, type Hex } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * Atestación de hechos de la cadena, verificada dentro de un contrato.
 *
 * El verificador del fallo demuestra que la aritmética se ejecuta on-chain, pero
 * no de dónde salen los siete números que se le pasan. Esta pieza cierra parte
 * de esa brecha con una propiedad de Arbitrum que casi nadie usa.
 *
 * Ningún opcode del EVM devuelve el nonce de una cuenta ajena. Un contrato no
 * puede saber cuántas transacciones firmó una wallet. Lo que sí puede es
 * verificar una prueba de Merkle-Patricia contra una raíz de estado: se le
 * entregan los nodos del camino, comprueba el hash en cada salto, y llega al
 * valor sin confiar en quien se los dio. Si alguien altera un byte, el hash deja
 * de cuadrar y la llamada revierte.
 *
 * La raíz, a su vez, sale de una cabecera de bloque cuyo keccak coincide con lo
 * que devuelve el precompilado ArbSys. Es decir, tampoco la raíz hay que
 * creérsela.
 *
 * Lo que esto NO hace, y conviene tenerlo claro antes de leer la tabla de
 * procedencia: no prueba el historial de préstamos. Prueba el estado actual de
 * la cuenta, y con él una cota superior sobre lo que esa wallet pudo hacer.
 */

export const ATTEST_ADDRESS = "0xce27abc23d456b2dce24967b669624569c396448" as const;

/** Nodo público de Arbitrum One, de donde sale la prueba. No es nuestro. */
const ARBITRUM_ONE_RPC = "https://arb1.arbitrum.io/rpc";

const ABI = [
  {
    type: "function",
    name: "previewAccount",
    stateMutability: "view",
    inputs: [
      { name: "stateRoot", type: "bytes32" },
      { name: "cuenta", type: "address" },
      { name: "prueba", type: "bytes[]" },
    ],
    outputs: [
      { name: "nonce", type: "uint64" },
      { name: "saldo", type: "uint256" },
      { name: "raizAlmacenamiento", type: "bytes32" },
      { name: "hashCodigo", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "peekStateRoot",
    stateMutability: "view",
    inputs: [{ name: "cabeceraRlp", type: "bytes" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const cliente = createPublicClient({
  chain: arbitrumSepolia,
  transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
});

/** Lo que un nodo devuelve al pedirle la prueba de una cuenta. */
type PruebaCuenta = {
  accountProof: Hex[];
  nonce: Hex;
  balance: Hex;
};

async function rpcArbitrumOne<T>(metodo: string, params: unknown[]): Promise<T> {
  const r = await fetch(ARBITRUM_ONE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: metodo, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${metodo}: ${j.error.message ?? "sin detalle"}`);
  return j.result as T;
}

export type HechoProbado = {
  /** Número de transacciones que esa dirección ha firmado. */
  transacciones: number;
  /** Saldo en wei, tal como lo demuestra la prueba. */
  saldoWei: bigint;
  /** Bloque de Arbitrum One contra cuyo estado se verificó. */
  bloque: number;
  /** Raíz de estado usada. Se puede contrastar contra un explorador. */
  raiz: Hex;
  /** Cuántos nodos tuvo que recorrer el contrato. */
  nodos: number;
};

/**
 * Demuestra, dentro del contrato, cuántas transacciones ha firmado una wallet.
 *
 * El bloque no se elige al azar: se usa uno reciente pero no el último, porque
 * los nodos públicos podan el estado enseguida y `eth_getProof` sobre la punta
 * de la cadena falla de forma intermitente. Cuatro bloques de margen es
 * suficiente y sigue siendo un dato de hace un segundo.
 */
export async function probarCuenta(direccion: Address): Promise<HechoProbado> {
  const punta = await rpcArbitrumOne<Hex>("eth_blockNumber", []);
  const bloque = Number(BigInt(punta) - 4n);

  const prueba = await rpcArbitrumOne<PruebaCuenta>("eth_getProof", [direccion, [], `0x${bloque.toString(16)}`]);

  const cabecera = await rpcArbitrumOne<{ stateRoot: Hex }>("eth_getBlockByNumber", [
    `0x${bloque.toString(16)}`,
    false,
  ]);

  // Aquí ocurre lo que importa: el contrato camina la prueba y comprueba el hash
  // en cada salto. Es una lectura pura, sin gas y sin firma, así que cualquiera
  // puede repetirla desde su propio navegador.
  const [nonce, saldo] = await cliente.readContract({
    address: ATTEST_ADDRESS,
    abi: ABI,
    functionName: "previewAccount",
    args: [cabecera.stateRoot, direccion, prueba.accountProof],
  });

  return {
    transacciones: Number(nonce),
    saldoWei: saldo,
    bloque,
    raiz: cabecera.stateRoot,
    nodos: prueba.accountProof.length,
  };
}

/** De dónde sale cada número del expediente. */
export type Procedencia = "probado" | "recalculable" | "declarado";

export type FilaProcedencia = {
  campo: string;
  valor: string;
  procedencia: Procedencia;
  /** Qué habría que hacer para comprobarlo por cuenta propia. */
  como: string;
};

/**
 * Construye la tabla de procedencia del expediente.
 *
 * Presentar los siete números como si fueran la misma clase de dato sería
 * cómodo y falso. No lo son:
 *
 * - Lo PROBADO lo demuestra el contrato con una prueba criptográfica.
 * - Lo RECALCULABLE sale de consultas a un nodo público sin clave de API, así
 *   que cualquiera con un nodo de archivo obtiene el mismo entero. No está
 *   probado on-chain porque exigiría anclar bloques de hace meses, y la ventana
 *   del precompilado son 256 bloques.
 * - Lo DECLARADO viene de un índice de terceros. Es donde el expediente descansa
 *   sobre confianza, y por eso se dice.
 */
export function tablaProcedencia(
  evidencia: {
    walletAgeDays: number;
    activeMonths: number;
    totalMonths: number;
    repayments: number;
    borrows: number;
    liquidations: number;
    distinctProtocols: number;
  },
  probado: HechoProbado | null,
): FilaProcedencia[] {
  const filas: FilaProcedencia[] = [];

  if (probado) {
    filas.push({
      campo: "Transacciones firmadas",
      valor: probado.transacciones.toLocaleString("es"),
      procedencia: "probado",
      como: `prueba de ${probado.nodos} nodos contra el estado del bloque ${probado.bloque.toLocaleString("es")}`,
    });
  }

  const recalculable = (campo: string, valor: number, unidad: string) => ({
    campo,
    valor: `${valor.toLocaleString("es")}${unidad}`,
    procedencia: "recalculable" as const,
    como: "bisección sobre el contador de transacciones, con un nodo de archivo",
  });

  filas.push(
    recalculable("Antigüedad", evidencia.walletAgeDays, " días"),
    recalculable("Meses con actividad", evidencia.activeMonths, ""),
    recalculable("Meses observados", evidencia.totalMonths, ""),
  );

  const declarado = (campo: string, valor: number) => ({
    campo,
    valor: valor.toLocaleString("es"),
    procedencia: "declarado" as const,
    como: "conteo de eventos desde un índice de terceros",
  });

  filas.push(
    declarado("Repagos", evidencia.repayments),
    declarado("Préstamos", evidencia.borrows),
    declarado("Liquidaciones", evidencia.liquidations),
    declarado("Contratos distintos", evidencia.distinctProtocols),
  );

  return filas;
}

/**
 * Comprueba que lo declarado quepa dentro de lo probado.
 *
 * Una wallet no puede haber hecho más operaciones que transacciones ha firmado.
 * Es una cota tosca y por eso mismo difícil de discutir: si el expediente
 * declara doce repagos y la cadena demuestra cinco transacciones en total, el
 * expediente miente y se ve sin salir de aquí.
 */
export function cotaCoherente(
  evidencia: { repayments: number; borrows: number },
  probado: HechoProbado | null,
): { cumple: boolean; operaciones: number; techo: number } | null {
  if (!probado) return null;
  const operaciones = evidencia.repayments + evidencia.borrows;
  return {
    cumple: operaciones <= probado.transacciones,
    operaciones,
    techo: probado.transacciones,
  };
}
