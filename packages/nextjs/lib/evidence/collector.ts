/**
 * Recolector de evidencia on-chain.
 *
 * Lee el historial real de una wallet en Arbitrum y lo convierte en el esquema
 * de evidencia que el contrato Stylus pondera. Todo lo que sale de aquí es
 * verificable por un tercero contra el mismo RPC: no hay estimaciones, no hay
 * datos rellenados y no hay nada que dependa de un servicio privado.
 *
 * El desafío es que un nodo no ofrece "dame las transacciones de esta wallet".
 * Eso normalmente exige un indexador. Pero `eth_getTransactionCount` sí responde
 * el nonce de una cuenta en cualquier bloque histórico, y el nonce sólo crece.
 * Sobre esa monotonía se pueden derivar dos dimensiones con exactitud y sin
 * depender de nadie: cuándo empezó a operar la wallet y en qué meses estuvo
 * activa. Ese es el método que implementa este módulo.
 */

import type { Address, PublicClient } from "viem";

/** Evidencia en el formato exacto que acepta el contrato Stylus. */
export type Evidence = {
  walletAgeDays: number;
  activeMonths: number;
  totalMonths: number;
  repayments: number;
  borrows: number;
  liquidations: number;
  distinctProtocols: number;
};

/** De dónde salió cada dimensión. La interfaz lo muestra junto al dato. */
export type Provenance = "rpc" | "indexer" | "unavailable";

export type CollectedEvidence = {
  address: Address;
  evidence: Evidence;
  /** Origen de cada dimensión, para que la UI no presente como medido algo que no lo está. */
  provenance: Record<keyof Evidence, Provenance>;
  /** Bloque en el que se tomó la lectura, para poder repetirla igual. */
  observedAtBlock: bigint;
  /** Primera transacción saliente detectada. Null si la wallet nunca envió una. */
  firstActivityBlock: bigint | null;
  /** Llamadas RPC consumidas. Sirve para vigilar el costo de la lectura. */
  rpcCalls: number;
};

const SECONDS_PER_DAY = 86_400;
/** Mes fijo de 30 días, el mismo que usa el contrato. Debe coincidir con DAYS_PER_MONTH. */
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 250;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reintenta con espera creciente.
 *
 * Los endpoints públicos de archivo devuelven errores 500 intermitentes bajo
 * carga. Una lectura de evidencia son decenas de llamadas encadenadas, así que
 * un único fallo transitorio tumbaría el expediente completo. Reintentar no
 * altera el resultado: las tres consultas que hacemos son deterministas sobre
 * un bloque fijo, de modo que repetir devuelve siempre el mismo valor.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS - 1) await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
  }
  throw lastError;
}

/**
 * Envuelve al cliente para contar las llamadas que realmente se hacen.
 *
 * La bisección es barata en teoría, pero conviene poder demostrarlo con un
 * número en lugar de afirmarlo.
 */
class CountingReader {
  public calls = 0;
  private blockCache = new Map<string, bigint>();

  constructor(private client: PublicClient) {}

  async nonceAt(address: Address, blockNumber: bigint): Promise<number> {
    this.calls += 1;
    return withRetry(() => this.client.getTransactionCount({ address, blockNumber }));
  }

  async timestampAt(blockNumber: bigint): Promise<bigint> {
    const key = blockNumber.toString();
    const cached = this.blockCache.get(key);
    if (cached !== undefined) return cached;
    this.calls += 1;
    const block = await withRetry(() => this.client.getBlock({ blockNumber }));
    this.blockCache.set(key, block.timestamp);
    return block.timestamp;
  }

  async latestBlockNumber(): Promise<bigint> {
    this.calls += 1;
    return withRetry(() => this.client.getBlockNumber());
  }
}

/**
 * Primer bloque en el que la wallet ya había enviado alguna transacción.
 *
 * Bisección sobre el nonce: es monótono creciente, así que la condición
 * "nonce > 0" parte la historia en dos mitades limpias. Sobre los ~400 millones
 * de bloques de Arbitrum, esto son unas 29 llamadas en vez de recorrer la cadena.
 */
async function findFirstActivityBlock(
  reader: CountingReader,
  address: Address,
  latest: bigint,
): Promise<bigint | null> {
  const nonceNow = await reader.nonceAt(address, latest);
  if (nonceNow === 0) return null;

  let low = 0n;
  let high = latest;
  while (low < high) {
    const mid = (low + high) / 2n;
    const nonce = await reader.nonceAt(address, mid);
    if (nonce > 0) {
      high = mid;
    } else {
      low = mid + 1n;
    }
  }
  return low;
}

/**
 * Bloque cuyo timestamp es el mayor que no supera al objetivo.
 *
 * No se estima dividiendo por un tiempo de bloque promedio: en Arbitrum ese
 * promedio varía con la carga y el error se acumula sobre rangos largos. La
 * bisección da el bloque correcto siempre.
 */
async function findBlockAtOrBefore(
  reader: CountingReader,
  targetTimestamp: bigint,
  low: bigint,
  high: bigint,
): Promise<bigint> {
  let lo = low;
  let hi = high;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    const ts = await reader.timestampAt(mid);
    if (ts <= targetTimestamp) {
      lo = mid;
    } else {
      hi = mid - 1n;
    }
  }
  return lo;
}

/**
 * Cuenta los meses en los que la wallet envió al menos una transacción.
 *
 * Recorre las fronteras mensuales desde la primera actividad y compara el nonce
 * a cada lado. Si creció, ese mes tuvo actividad. Mide transacciones salientes,
 * que es lo que el nonce refleja; recibir fondos no cuenta como actividad, y esa
 * distinción es deliberada, porque una wallet que sólo recibe no demuestra uso.
 */
async function countActiveMonths(
  reader: CountingReader,
  address: Address,
  firstBlock: bigint,
  latestBlock: bigint,
  firstTimestamp: bigint,
  latestTimestamp: bigint,
): Promise<{ activeMonths: number; totalMonths: number }> {
  const totalMonths = Number((latestTimestamp - firstTimestamp) / BigInt(SECONDS_PER_MONTH));
  if (totalMonths <= 0) {
    // Menos de un mes de vida: cuenta como un único mes, y está activo por
    // definición, porque hubo al menos una transacción.
    return { activeMonths: 1, totalMonths: 1 };
  }

  let activeMonths = 0;
  let previousNonce = await reader.nonceAt(address, firstBlock);
  let previousBlock = firstBlock;

  for (let month = 1; month <= totalMonths; month++) {
    const boundary = firstTimestamp + BigInt(month * SECONDS_PER_MONTH);
    const block = await findBlockAtOrBefore(reader, boundary, previousBlock, latestBlock);
    const nonce = await reader.nonceAt(address, block);
    if (nonce > previousNonce) activeMonths += 1;
    previousNonce = nonce;
    previousBlock = block;
  }

  // El primer mes contiene por definición la primera transacción.
  if (activeMonths === 0) activeMonths = 1;

  return { activeMonths, totalMonths };
}

/**
 * Reúne la evidencia de una wallet.
 *
 * Las dimensiones de crédito (repagos, préstamos y liquidaciones) requieren
 * recorrer logs de protocolos de préstamo, algo que un RPC público no permite
 * sobre rangos largos. Se dejan en cero y marcadas como no disponibles en vez de
 * estimarlas: un cero honesto baja el puntaje, pero un número inventado
 * rompería la promesa de que el fallo es reproducible.
 */
export async function collectEvidence(client: PublicClient, address: Address): Promise<CollectedEvidence> {
  const reader = new CountingReader(client);
  const latestBlock = await reader.latestBlockNumber();
  const latestTimestamp = await reader.timestampAt(latestBlock);

  const firstActivityBlock = await findFirstActivityBlock(reader, address, latestBlock);

  if (firstActivityBlock === null) {
    return {
      address,
      evidence: {
        walletAgeDays: 0,
        activeMonths: 0,
        totalMonths: 0,
        repayments: 0,
        borrows: 0,
        liquidations: 0,
        distinctProtocols: 0,
      },
      provenance: {
        walletAgeDays: "rpc",
        activeMonths: "rpc",
        totalMonths: "rpc",
        repayments: "unavailable",
        borrows: "unavailable",
        liquidations: "unavailable",
        distinctProtocols: "unavailable",
      },
      observedAtBlock: latestBlock,
      firstActivityBlock: null,
      rpcCalls: reader.calls,
    };
  }

  const firstTimestamp = await reader.timestampAt(firstActivityBlock);
  const walletAgeDays = Number((latestTimestamp - firstTimestamp) / BigInt(SECONDS_PER_DAY));

  const { activeMonths, totalMonths } = await countActiveMonths(
    reader,
    address,
    firstActivityBlock,
    latestBlock,
    firstTimestamp,
    latestTimestamp,
  );

  return {
    address,
    evidence: {
      walletAgeDays,
      activeMonths,
      totalMonths,
      repayments: 0,
      borrows: 0,
      liquidations: 0,
      distinctProtocols: 0,
    },
    provenance: {
      walletAgeDays: "rpc",
      activeMonths: "rpc",
      totalMonths: "rpc",
      repayments: "unavailable",
      borrows: "unavailable",
      liquidations: "unavailable",
      distinctProtocols: "unavailable",
    },
    observedAtBlock: latestBlock,
    firstActivityBlock,
    rpcCalls: reader.calls,
  };
}
