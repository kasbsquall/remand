/**
 * Acceso al contrato RemandVerdict desplegado en Arbitrum Sepolia.
 *
 * La lectura del fallo y su reproducción se hacen contra la cadena, no contra
 * una copia del motor en TypeScript. Reimplementar la ponderación aquí sería
 * más rápido, pero abriría la puerta a que la interfaz y el contrato divergieran
 * sin que nadie lo note, y entonces el verificador estaría verificando otra
 * cosa. Todo número que la interfaz presenta como fallo sale de Arbitrum.
 */

import { createPublicClient, encodePacked, http, keccak256 } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";

export const REMAND_VERDICT_ADDRESS = "0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a" as const;

export const ARBISCAN_BASE = "https://sepolia.arbiscan.io";

export const remandAbi = [
  {
    type: "function",
    name: "previewVerdict",
    stateMutability: "view",
    inputs: [
      { name: "wallet_age_days", type: "uint32" },
      { name: "active_months", type: "uint32" },
      { name: "total_months", type: "uint32" },
      { name: "repayments", type: "uint32" },
      { name: "borrows", type: "uint32" },
      { name: "liquidations", type: "uint32" },
      { name: "distinct_protocols", type: "uint32" },
    ],
    outputs: [
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "bool" },
      { type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "getRuling",
    stateMutability: "view",
    inputs: [{ name: "case_id", type: "uint256" }],
    outputs: [
      { type: "address" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "bool" },
      { type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "weights",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "isJudged",
    stateMutability: "view",
    inputs: [{ name: "case_id", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "totalAppeals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "submitAppeal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "case_id", type: "uint256" },
      { name: "wallet_age_days", type: "uint32" },
      { name: "active_months", type: "uint32" },
      { name: "total_months", type: "uint32" },
      { name: "repayments", type: "uint32" },
      { name: "borrows", type: "uint32" },
      { name: "liquidations", type: "uint32" },
      { name: "distinct_protocols", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

export const sepoliaClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
});

/** El fallo tal como lo devuelve el contrato, en puntos base. */
export type Verdict = {
  scoreRepayment: number;
  scoreConsistency: number;
  scoreAge: number;
  scoreLiquidation: number;
  scoreDiversity: number;
  totalScore: number;
  approved: boolean;
  collateralRequiredBps: number;
};

type VerdictTuple = readonly [number, number, number, number, number, number, boolean, number];

function toVerdict(t: VerdictTuple): Verdict {
  return {
    scoreRepayment: t[0],
    scoreConsistency: t[1],
    scoreAge: t[2],
    scoreLiquidation: t[3],
    scoreDiversity: t[4],
    totalScore: t[5],
    approved: t[6],
    collateralRequiredBps: t[7],
  };
}

export type EvidenceInput = {
  walletAgeDays: number;
  activeMonths: number;
  totalMonths: number;
  repayments: number;
  borrows: number;
  liquidations: number;
  distinctProtocols: number;
};

/**
 * Reproduce un fallo ejecutando el motor del contrato. Es una vista pura: no
 * cuesta gas, no requiere wallet y devuelve exactamente lo que devolvería
 * `submitAppeal` con la misma evidencia.
 */
export async function previewVerdict(e: EvidenceInput): Promise<Verdict> {
  const result = (await sepoliaClient.readContract({
    address: REMAND_VERDICT_ADDRESS,
    abi: remandAbi,
    functionName: "previewVerdict",
    args: [
      e.walletAgeDays,
      e.activeMonths,
      e.totalMonths,
      e.repayments,
      e.borrows,
      e.liquidations,
      e.distinctProtocols,
    ],
  })) as VerdictTuple;
  return toVerdict(result);
}

/** Lee el fallo registrado de un expediente. */
export async function getRuling(caseId: bigint): Promise<{ appellant: string } & Verdict> {
  const r = (await sepoliaClient.readContract({
    address: REMAND_VERDICT_ADDRESS,
    abi: remandAbi,
    functionName: "getRuling",
    args: [caseId],
  })) as readonly [string, number, number, number, number, number, number, boolean, number];

  return {
    appellant: r[0],
    ...toVerdict([r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]] as VerdictTuple),
  };
}

/** Pesos y umbral vigentes, leídos del contrato y no de una copia local. */
export async function readWeights() {
  const w = (await sepoliaClient.readContract({
    address: REMAND_VERDICT_ADDRESS,
    abi: remandAbi,
    functionName: "weights",
  })) as readonly [number, number, number, number, number, number];

  return {
    repayment: w[0],
    consistency: w[1],
    age: w[2],
    liquidation: w[3],
    diversity: w[4],
    threshold: w[5],
  };
}

/**
 * Cliente de Arbitrum One.
 *
 * La evidencia sale de la red real, así que el bloque de corte tiene que leerse
 * de ahí. Sin ese corte, "reproducible" lleva un asterisco: la evidencia de ayer
 * ya no existe y nadie podría rehacer el fallo de ayer.
 */
export const arbitrumOneClient = createPublicClient({
  chain: arbitrum,
  transport: http("https://arb1.arbitrum.io/rpc"),
});

/**
 * Número de expediente, derivado de la wallet y del bloque de corte.
 *
 * Es determinista a propósito: el mismo apelante evaluado hasta el mismo bloque
 * produce siempre el mismo expediente, así que dos personas que abran el caso
 * llegan al mismo número sin coordinarse. Y como el bloque avanza, una apelación
 * posterior con más historial es un expediente distinto en vez de un intento de
 * sobrescribir el anterior, que el contrato rechazaría.
 */
export function caseIdFor(address: string, observedAtBlock: bigint): bigint {
  const packed = encodePacked(["address", "uint64"], [address as `0x${string}`, observedAtBlock]);
  return BigInt(keccak256(packed));
}

/** Referencia legible del expediente. El número completo es de 77 dígitos. */
export function caseRef(caseId: bigint): string {
  const hex = caseId.toString(16).padStart(64, "0");
  return `${hex.slice(0, 4)}-${hex.slice(-4)}`.toUpperCase();
}

/** Si un expediente ya tiene fallo asentado en la cadena. */
export async function isJudged(caseId: bigint): Promise<boolean> {
  return (await sepoliaClient.readContract({
    address: REMAND_VERDICT_ADDRESS,
    abi: remandAbi,
    functionName: "isJudged",
    args: [caseId],
  })) as boolean;
}

/** Cantidad de apelaciones falladas hasta ahora. */
export async function totalAppeals(): Promise<bigint> {
  return (await sepoliaClient.readContract({
    address: REMAND_VERDICT_ADDRESS,
    abi: remandAbi,
    functionName: "totalAppeals",
  })) as bigint;
}

/** Formatea puntos base como porcentaje con dos decimales. */
export function bps(value: number): string {
  return (value / 100).toFixed(2);
}
