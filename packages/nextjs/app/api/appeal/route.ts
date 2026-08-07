/**
 * Arma el expediente completo de una apelación.
 *
 * Corre en el servidor porque toca dos claves que no pueden llegar al navegador:
 * la del indexador y la del modelo. Devuelve la evidencia recolectada, los
 * argumentos de ambos agentes y el fallo que el contrato emitiría con esa misma
 * evidencia, leído de Arbitrum y no calculado aquí.
 */

import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { buildCaseFile } from "~~/lib/agents";
import { arbitrumOneClient, caseIdFor, isJudged, previewVerdict, readWeights } from "~~/lib/contract";
import { collectEvidenceFromIndexer } from "~~/lib/evidence/indexer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let address: string;

  try {
    const body = (await request.json()) as { address?: unknown };
    if (typeof body.address !== "string" || !isAddress(body.address)) {
      return NextResponse.json({ error: "Esa no es una dirección de Ethereum válida." }, { status: 400 });
    }
    address = body.address;
  } catch {
    return NextResponse.json({ error: "No se pudo leer la solicitud." }, { status: 400 });
  }

  const indexerKey = process.env.ETHERSCAN_API_KEY;
  if (!indexerKey) {
    return NextResponse.json({ error: "El servidor no tiene configurada la clave del indexador." }, { status: 503 });
  }

  try {
    // El bloque de corte se fija antes de leer nada. Es lo que convierte al
    // expediente en un documento con fecha: sin él, la misma consulta mañana
    // evalúa otra evidencia y el fallo de hoy no se podría reproducir.
    const observedAtBlock = await arbitrumOneClient.getBlockNumber();
    const collected = await collectEvidenceFromIndexer(address, indexerKey, observedAtBlock);
    const caseId = caseIdFor(address, observedAtBlock);

    // El fallo y los argumentos se piden a la vez: no dependen entre sí. El
    // veredicto sale del contrato aunque los agentes fallen, que es
    // exactamente la separación que el proyecto defiende.
    const [verdict, weights, caseFile, alreadyJudged] = await Promise.all([
      previewVerdict(collected.evidence),
      readWeights(),
      buildCaseFile(collected, process.env.ANTHROPIC_API_KEY),
      isJudged(caseId),
    ]);

    return NextResponse.json({
      address,
      evidence: collected.evidence,
      provenance: collected.provenance,
      truncated: collected.truncated,
      rawRepayments: collected.rawRepayments ?? null,
      observedAtBlock: observedAtBlock.toString(),
      caseId: caseId.toString(),
      alreadyJudged,
      verdict,
      weights,
      caseFile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: `No se pudo reunir la evidencia: ${message}` }, { status: 502 });
  }
}
