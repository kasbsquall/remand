"use client";

/**
 * Registro público de fallos.
 *
 * Todos los expedientes asentados en el contrato, leídos de la cadena. Existe
 * porque un sistema que promete jurisprudencia tiene que poder enseñarla: sin
 * esta vista, `getRuling` y `totalAppeals` serían funciones que nadie consulta,
 * y el registro de expedientes una promesa sin evidencia.
 *
 * La lectura va directa a Arbitrum desde el navegador, igual que el verificador.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle, Warning } from "@phosphor-icons/react";
import { parseAbiItem } from "viem";
import { Docket, docketNumber } from "~~/components/remand/Docket";
import { ARBISCAN_BASE, bps, caseRef, REMAND_VERDICT_ADDRESS, sepoliaClient } from "~~/lib/contract";

/**
 * El evento del fallo, con su desglose completo.
 *
 * Se declara aquí en vez de reutilizar el ABI del contrato porque `getLogs`
 * necesita la firma con los nombres de parámetro para decodificar.
 */
const VERDICT_ISSUED = parseAbiItem(
  "event VerdictIssued(uint256 indexed caseId, address indexed appellant, uint32 scoreRepayment, uint32 scoreConsistency, uint32 scoreAge, uint32 scoreLiquidation, uint32 scoreDiversity, uint32 totalScore, bool approved, uint32 collateralRequiredBps)",
);

type Fallo = {
  caseId: bigint;
  appellant: string;
  totalScore: number;
  approved: boolean;
  collateralRequiredBps: number;
  blockNumber: bigint;
  txHash: string;
};

export default function Registro() {
  const [fallos, setFallos] = useState<Fallo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leer = useCallback(async () => {
    setError(null);
    try {
      const logs = await sepoliaClient.getLogs({
        address: REMAND_VERDICT_ADDRESS,
        event: VERDICT_ISSUED,
        fromBlock: 0n,
        toBlock: "latest",
      });

      const filas: Fallo[] = logs
        .map(log => ({
          caseId: log.args.caseId as bigint,
          appellant: log.args.appellant as string,
          totalScore: Number(log.args.totalScore),
          approved: Boolean(log.args.approved),
          collateralRequiredBps: Number(log.args.collateralRequiredBps),
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? "",
        }))
        // El más reciente arriba: un registro se lee por lo último que entró.
        .sort((a, b) => Number(b.blockNumber - a.blockNumber));

      setFallos(filas);
    } catch {
      setError("No se pudo leer el registro. La red no respondió a tiempo.");
    }
  }, []);

  useEffect(() => {
    leer();
  }, [leer]);

  const concedidas = fallos?.filter(f => f.approved).length ?? 0;

  return (
    <Docket reference={docketNumber("R")}>
      <section className="pt-[var(--ma-section)]">
        <p className="remand-label remand-enter">Registro público</p>
        <h1
          className="remand-display remand-enter mt-[var(--ma-close)]"
          style={{ fontSize: "var(--t-title)", maxWidth: "24ch", "--delay": "60ms" } as React.CSSProperties}
        >
          Todos los fallos emitidos por este contrato.
        </h1>
        <p
          className="remand-prose remand-enter mt-[var(--ma-block)]"
          style={{ "--delay": "120ms" } as React.CSSProperties}
        >
          Leídos de Arbitrum, no de nuestra base de datos. Ninguno se puede editar ni borrar, y cualquiera puede
          recorrer esta misma lista consultando los eventos del contrato.
        </p>
      </section>

      <section className="mt-[var(--ma-section)]" aria-live="polite">
        {error && (
          <div className="remand-sunk p-[var(--ma-block)]" role="alert">
            <div className="flex items-start gap-[var(--ma-tight)]">
              <Warning
                size={16}
                weight="light"
                aria-hidden="true"
                className="remand-glyph-inline"
                style={{ color: "var(--denied)" }}
              />
              <div>
                <p className="remand-prose">{error}</p>
                <button type="button" className="remand-action mt-[var(--ma-close)]" onClick={leer}>
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        )}

        {!fallos && !error && (
          <div className="grid gap-[var(--ma-close)]">
            <div className="remand-skeleton" style={{ height: "3rem" }} />
            <div className="remand-skeleton" style={{ height: "9rem" }} />
          </div>
        )}

        {fallos && (
          <>
            <div className="flex flex-wrap items-end gap-[var(--ma-chapter)]">
              <div>
                <p className="remand-label">Expedientes fallados</p>
                <p
                  className="remand-num"
                  style={{ fontSize: "var(--t-total)", lineHeight: 0.9, fontWeight: 500, letterSpacing: "-0.035em" }}
                >
                  {fallos.length}
                </p>
              </div>
              <div>
                <p className="remand-label">Concedidos</p>
                <p className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-lead)" }}>
                  {concedidas} de {fallos.length}
                </p>
              </div>
            </div>

            {fallos.length === 0 ? (
              <div className="remand-sunk mt-[var(--ma-block)] p-[var(--ma-block)]">
                <p className="remand-label" style={{ color: "var(--ink)" }}>
                  Registro vacío
                </p>
                <p className="remand-prose mt-[var(--ma-tight)]">
                  Todavía no hay fallos asentados. Abre una apelación y asiéntala para que aparezca aquí.
                </p>
                <Link href="/" className="remand-action remand-action-quiet mt-[var(--ma-block)]">
                  Abrir una apelación
                </Link>
              </div>
            ) : (
              <div className="mt-[var(--ma-block)]" style={{ borderTop: "1px solid var(--rule-strong)" }}>
                <div
                  className="remand-label remand-ledger-head hidden md:grid"
                  style={{ paddingTop: "var(--ma-close)", paddingBottom: "var(--ma-tight)" }}
                >
                  <span>Expediente</span>
                  <span className="text-right">Puntaje</span>
                  <span className="text-right">Colateral</span>
                  <span className="text-right">Fallo</span>
                </div>

                {fallos.map((f, index) => (
                  <div
                    key={f.txHash + f.caseId.toString()}
                    className="remand-ledger-row remand-enter"
                    style={{ "--delay": `${Math.min(index, 7) * 30}ms` } as React.CSSProperties}
                  >
                    <div className="flex items-start gap-[var(--ma-close)]">
                      <span className="remand-folio" aria-hidden="true">
                        {String(fallos.length - index).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="remand-num" style={{ fontSize: "var(--t-small)" }}>
                          {caseRef(f.caseId)}
                        </p>
                        <a
                          href={`${ARBISCAN_BASE}/address/${f.appellant}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="remand-link remand-num"
                          style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}
                        >
                          {f.appellant.slice(0, 10)}…{f.appellant.slice(-6)}
                          <span className="sr-only">(se abre en una pestaña nueva)</span>
                        </a>
                      </div>
                    </div>

                    <dl className="remand-ledger-figures">
                      <div className="remand-ledger-figure">
                        <dt className="remand-label">Puntaje</dt>
                        <dd className="remand-num" style={{ fontSize: "var(--t-small)" }}>
                          {bps(f.totalScore)}%
                        </dd>
                      </div>
                      <div className="remand-ledger-figure">
                        <dt className="remand-label">Colateral</dt>
                        <dd className="remand-num" style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}>
                          {bps(f.collateralRequiredBps)}%
                        </dd>
                      </div>
                      <div className="remand-ledger-figure">
                        <dt className="remand-label">Fallo</dt>
                        <dd
                          className="remand-num"
                          style={{
                            fontSize: "var(--t-small)",
                            fontWeight: 600,
                            color: f.approved ? "var(--granted)" : "var(--denied)",
                          }}
                        >
                          <span className="inline-flex items-center gap-[var(--ma-hair)]">
                            {f.approved ? (
                              <CheckCircle size={16} weight="light" aria-hidden="true" />
                            ) : (
                              <Warning size={16} weight="light" aria-hidden="true" />
                            )}
                            {f.approved ? "Concedida" : "Denegada"}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}

            <p
              className="mt-[var(--ma-block)] flex items-start gap-[var(--ma-tight)]"
              style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)", maxWidth: "70ch" }}
            >
              <ArrowUpRight size={16} weight="light" aria-hidden="true" className="remand-glyph-inline" />
              Cada fila sale de un evento <span className="remand-num">VerdictIssued</span> del contrato. El desglose
              completo de cualquiera de ellos se recupera con <span className="remand-num">getRuling</span>.
            </p>
          </>
        )}
      </section>
    </Docket>
  );
}
