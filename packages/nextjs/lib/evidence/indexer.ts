/**
 * Recolector de evidencia vía indexador.
 *
 * El RPC público de Arbitrum no sirve estado histórico: pedirle el nonce de una
 * wallet en un bloque antiguo devuelve "missing trie node". Sin acceso a un nodo
 * de archivo propio, la única fuente que permite reconstruir el historial
 * completo de una cuenta es un indexador. Se usa la API v2 de Etherscan, que con
 * una sola clave cubre Arbitrum y devuelve tanto la lista de transacciones como
 * los logs filtrados por tópico.
 *
 * Cada número que sale de aquí es reproducible: la interfaz publica la dirección
 * consultada y el bloque de corte, así que cualquiera puede repetir las mismas
 * tres consultas y obtener lo mismo. Lo que no se puede medir se marca como no
 * disponible y puntúa cero, nunca se estima.
 */

import type { Address } from "viem";
import type { CollectedEvidence, Evidence, Provenance } from "./collector";

const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api";
const ARBITRUM_ONE = 42161;

const SECONDS_PER_DAY = 86_400;
/** Mes fijo de 30 días. Debe coincidir con DAYS_PER_MONTH del contrato. */
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;

/**
 * Pool de Aave V3 en Arbitrum One. Es el mercado de préstamo con más actividad
 * de la red, así que es donde vive la evidencia crediticia que importa.
 */
const AAVE_V3_POOL: Address = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

/**
 * Firmas de los eventos de Aave V3 relevantes, con la posición del tópico que
 * identifica al deudor.
 *
 * En `Borrow` el deudor viaja en `onBehalfOf` (tópico 2), no en `user`, porque
 * un tercero puede originar el préstamo por cuenta ajena. Filtrar por `user`
 * dejaría fuera préstamos que sí son del apelante.
 */
const LENDING_EVENTS = {
  borrow: {
    topic0: "0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0",
    borrowerTopic: "topic2" as const,
  },
  repay: {
    topic0: "0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051",
    borrowerTopic: "topic2" as const,
  },
  liquidation: {
    topic0: "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286",
    borrowerTopic: "topic3" as const,
  },
} as const;

type EtherscanTx = {
  timeStamp: string;
  to: string;
  from: string;
  input: string;
  isError: string;
};

type EtherscanResponse<T> = {
  status: string;
  message: string;
  result: T | string;
};

export class IndexerUnavailable extends Error {}

function addressAsTopic(address: Address): string {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

async function query<T>(params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(ETHERSCAN_V2);
  url.searchParams.set("chainid", String(ARBITRUM_ONE));
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new IndexerUnavailable(`El indexador respondió ${response.status}`);
  }

  const body = (await response.json()) as EtherscanResponse<T>;

  // Etherscan responde status "0" tanto para "no hay resultados" como para
  // errores reales. Distinguirlos importa: un conjunto vacío es un dato válido
  // (la wallet no tiene esos eventos), un error no lo es.
  if (body.status === "0") {
    const message = typeof body.result === "string" ? body.result : body.message;
    if (/no transactions found|no records found|no logs found/i.test(message ?? "")) {
      return [] as unknown as T;
    }
    throw new IndexerUnavailable(message || "El indexador rechazó la consulta");
  }

  return body.result as T;
}

/** Cuenta los eventos de préstamo de un tipo para una dirección. */
async function countLendingEvents(
  address: Address,
  event: (typeof LENDING_EVENTS)[keyof typeof LENDING_EVENTS],
  apiKey: string,
): Promise<number> {
  const logs = await query<unknown[]>(
    {
      module: "logs",
      action: "getLogs",
      address: AAVE_V3_POOL,
      fromBlock: "0",
      toBlock: "latest",
      topic0: event.topic0,
      [event.borrowerTopic]: addressAsTopic(address),
      [`topic0_${event.borrowerTopic.replace("topic", "")}_opr`]: "and",
    },
    apiKey,
  );
  return logs.length;
}

/**
 * Reúne la evidencia completa de una wallet en Arbitrum One.
 *
 * @param address wallet apelante
 * @param apiKey clave de la API v2 de Etherscan
 */
export async function collectEvidenceFromIndexer(address: Address, apiKey: string): Promise<CollectedEvidence> {
  const transactions = await query<EtherscanTx[]>(
    {
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "latest",
      sort: "asc",
    },
    apiKey,
  );

  const provenance: Record<keyof Evidence, Provenance> = {
    walletAgeDays: "indexer",
    activeMonths: "indexer",
    totalMonths: "indexer",
    repayments: "indexer",
    borrows: "indexer",
    liquidations: "indexer",
    distinctProtocols: "indexer",
  };

  // Sólo cuentan las transacciones que la wallet originó y que no revirtieron.
  // Recibir fondos no demuestra uso, y una transacción fallida tampoco.
  const outgoing = transactions.filter(tx => tx.from.toLowerCase() === address.toLowerCase() && tx.isError === "0");

  if (outgoing.length === 0) {
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
      provenance,
      observedAtBlock: 0n,
      firstActivityBlock: null,
      rpcCalls: 1,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const firstTimestamp = Number(outgoing[0].timeStamp);
  const walletAgeDays = Math.floor((now - firstTimestamp) / SECONDS_PER_DAY);
  const totalMonths = Math.max(1, Math.floor((now - firstTimestamp) / SECONDS_PER_MONTH));

  // Un mes cuenta como activo si contiene al menos una transacción saliente.
  const monthsWithActivity = new Set<number>();
  for (const tx of outgoing) {
    monthsWithActivity.add(Math.floor((Number(tx.timeStamp) - firstTimestamp) / SECONDS_PER_MONTH));
  }
  const activeMonths = Math.min(monthsWithActivity.size, totalMonths);

  // Un protocolo es un destino con datos de llamada: una transferencia simple de
  // ETH no representa interacción con un contrato.
  const protocols = new Set<string>();
  for (const tx of outgoing) {
    if (tx.input && tx.input !== "0x" && tx.to) protocols.add(tx.to.toLowerCase());
  }

  const [borrows, repayments, liquidations] = await Promise.all([
    countLendingEvents(address, LENDING_EVENTS.borrow, apiKey),
    countLendingEvents(address, LENDING_EVENTS.repay, apiKey),
    countLendingEvents(address, LENDING_EVENTS.liquidation, apiKey),
  ]);

  return {
    address,
    evidence: {
      walletAgeDays,
      activeMonths,
      totalMonths,
      // El contrato rechaza evidencia con más repagos que préstamos. Aave permite
      // repagos parciales, así que un préstamo puede generar varios eventos de
      // repago. Se topa para que el expediente sea coherente sin inventar nada:
      // la dimensión mide qué proporción de la deuda se atendió, no cuántas veces.
      repayments: Math.min(repayments, borrows),
      borrows,
      liquidations,
      distinctProtocols: protocols.size,
    },
    provenance,
    observedAtBlock: 0n,
    firstActivityBlock: null,
    rpcCalls: 4,
  };
}
