"use client";

/**
 * Segunda instancia: el expediente de la apelación.
 *
 * Reúne la evidencia, muestra lo que sostiene cada agente y publica el fallo que
 * el contrato emite con esos datos. El orden de la pantalla es deliberado:
 * primero la evidencia, después la discusión, y sólo al final el resultado. Un
 * veredicto que aparece antes que su sustento invita a creerlo en vez de a
 * comprobarlo.
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle, Gavel, Scales, SealCheck, ShieldChevron, Warning } from "@phosphor-icons/react";
import { Docket, docketNumber } from "~~/components/remand/Docket";
import { Guilloche } from "~~/components/remand/Guilloche";
import { CaseFingerprint } from "~~/components/remand/CaseFingerprint";
import { Procedencia } from "~~/components/remand/Procedencia";
import { RegisterRuling } from "~~/components/remand/RegisterRuling";
import { EvidenceLimits, Shortfall } from "~~/components/remand/ShortfallAndLimits";
import { VerdictLedger, type Weights } from "~~/components/remand/VerdictLedger";
import { ARBISCAN_BASE, bps, REMAND_VERDICT_ADDRESS, type Verdict } from "~~/lib/contract";
import type { Argument, CaseFile } from "~~/lib/agents";
import type { Evidence, Provenance } from "~~/lib/evidence/collector";

type AppealResponse = {
  address: string;
  evidence: Evidence;
  provenance: Record<keyof Evidence, Provenance>;
  truncated: (keyof Evidence)[];
  rawRepayments: number | null;
  observedAtBlock: string;
  caseId: string;
  alreadyJudged: boolean;
  verdict: Verdict;
  weights: Weights;
  caseFile: CaseFile;
};

const EVIDENCE_LABELS: Record<keyof Evidence, string> = {
  walletAgeDays: "Antigüedad",
  activeMonths: "Meses activos",
  totalMonths: "Meses de vida",
  repayments: "Repagos",
  borrows: "Préstamos",
  liquidations: "Liquidaciones",
  distinctProtocols: "Protocolos",
};

const EVIDENCE_UNITS: Partial<Record<keyof Evidence, string>> = {
  walletAgeDays: "días",
  activeMonths: "meses",
  totalMonths: "meses",
};

function EvidenceGrid({ data }: { data: AppealResponse }) {
  const keys = Object.keys(EVIDENCE_LABELS) as (keyof Evidence)[];

  return (
    <div className="grid grid-cols-2 gap-px md:grid-cols-4" style={{ background: "var(--rule)" }}>
      {keys.map((key, index) => {
        const unavailable = data.provenance[key] === "unavailable";
        const isTruncated = data.truncated.includes(key);
        return (
          <div
            key={key}
            className="remand-enter p-[var(--ma-close)]"
            style={
              { background: "var(--paper-raised)", "--delay": `${Math.min(index, 7) * 30}ms` } as React.CSSProperties
            }
          >
            <p className="remand-label">{EVIDENCE_LABELS[key]}</p>
            <p className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-lead)", fontWeight: 500 }}>
              {data.evidence[key]}
              {EVIDENCE_UNITS[key] && (
                <span style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)", marginLeft: "0.3em" }}>
                  {EVIDENCE_UNITS[key]}
                </span>
              )}
            </p>
            {unavailable && (
              <p
                style={{ fontSize: "var(--t-micro)", color: "var(--seal)" }}
                title="La fuente consultada no expone este dato. El contrato lo evalúa como cero."
              >
                sin datos en la fuente
              </p>
            )}
            {key === "repayments" && data.rawRepayments !== null && data.rawRepayments > data.evidence.repayments && (
              <p
                style={{ fontSize: "var(--t-micro)", color: "var(--seal)", lineHeight: 1.35 }}
                title="Aave emite un evento por cada repago parcial. La dimensión mide qué proporción de la deuda se atendió, no cuántas veces se pagó."
              >
                topado a los préstamos · {data.rawRepayments} eventos leídos
              </p>
            )}
            {isTruncated && (
              <p
                style={{ fontSize: "var(--t-micro)", color: "var(--seal)" }}
                title="La fuente devuelve un máximo de resultados. El total real puede ser mayor."
              >
                al menos esta cifra
              </p>
            )}
          </div>
        );
      })}

      {/* Octava celda: cierra la rejilla de cuatro columnas y declara de donde
          salio el dato. Sin ella quedaba un hueco relleno que se leia como un
          fallo de maquetacion. */}
      <div
        className="remand-enter remand-guard p-[var(--ma-close)]"
        style={{ "--delay": "210ms" } as React.CSSProperties}
      >
        <p className="remand-label">Fuente</p>
        <p className="mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-small)", lineHeight: 1.4 }}>
          Historial público de Arbitrum One y eventos del pool de Aave V3
        </p>
      </div>
    </div>
  );
}

function ArgumentList({
  title,
  meaning,
  items,
  Glyph,
  tone,
}: {
  title: string;
  meaning: string;
  items: Argument[];
  Glyph: typeof Scales;
  tone: string;
}) {
  return (
    <section className="remand-sheet p-[var(--ma-block)]">
      <header className="flex items-start gap-[var(--ma-tight)]">
        <Glyph size={20} weight="light" aria-hidden="true" style={{ color: tone, flexShrink: 0 }} />
        <div>
          <h3 className="remand-label" style={{ color: "var(--ink)" }}>
            {title}
          </h3>
          <p style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}>{meaning}</p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="mt-[var(--ma-block)]" style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}>
          Sin puntos que registrar con esta evidencia.
        </p>
      ) : (
        <ol className="mt-[var(--ma-close)]">
          {items.map((item, index) => (
            <li
              key={`${item.dimension}-${index}`}
              className="remand-row"
              style={{ gridTemplateColumns: "auto 1fr", alignItems: "start" }}
            >
              <span
                className="remand-num"
                aria-hidden="true"
                style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p style={{ lineHeight: 1.4 }}>{item.headline}</p>
                <p
                  className="mt-[var(--ma-hair)]"
                  style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", lineHeight: 1.55 }}
                >
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LoadingDocket() {
  return (
    <div className="pt-[var(--ma-section)]">
      <p className="remand-label">Reuniendo evidencia en Arbitrum</p>
      <div className="mt-[var(--ma-block)] grid gap-[var(--ma-close)]">
        <div className="remand-skeleton" style={{ height: "1.2rem", maxWidth: "24rem" }} />
        <div className="remand-skeleton" style={{ height: "5rem" }} />
        <div className="remand-skeleton" style={{ height: "12rem" }} />
      </div>
      <p className="mt-[var(--ma-block)]" style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}>
        Se consulta el historial de transacciones y los eventos de préstamo, repago y liquidación. Suele tardar unos
        segundos.
      </p>
    </div>
  );
}

export default function Apelacion({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [data, setData] = useState<AppealResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cambiarlo relanza la lectura sin recargar la pagina.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch("/api/appeal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo abrir el expediente.");
        setData(body as AppealResponse);
      })
      .catch(caught => {
        if (caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "No se pudo abrir el expediente.");
      });

    return () => controller.abort();
  }, [address, reload]);

  // Una wallet sin actividad de préstamo merece que se le diga, en vez de
  // mostrarle cinco medidores en cero como si fueran una medición.
  const sinHistorial =
    data !== null && data.evidence.borrows === 0 && data.evidence.repayments === 0 && data.evidence.walletAgeDays === 0;

  return (
    <Docket reference={docketNumber("II", address)}>
      {!data && !error && <LoadingDocket />}

      {error && (
        <div className="remand-sunk mt-[var(--ma-section)] p-[var(--ma-block)]" role="alert">
          <div className="flex items-start gap-[var(--ma-tight)]">
            <Warning size={20} weight="light" aria-hidden="true" style={{ color: "var(--denied)" }} />
            <div>
              <p className="remand-label" style={{ color: "var(--ink)" }}>
                No se pudo abrir el expediente
              </p>
              <p className="remand-prose mt-[var(--ma-tight)]">
                No se pudo reunir el historial de esta wallet en Arbitrum. Puede ser una caída temporal de la fuente de
                datos. Vuelve a intentarlo en un minuto o prueba con otra dirección.
              </p>
              <p
                className="remand-num mt-[var(--ma-tight)]"
                style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}
              >
                {error}
              </p>
              <div className="mt-[var(--ma-block)] flex flex-wrap gap-[var(--ma-close)]">
                <button type="button" className="remand-action" onClick={() => setReload(n => n + 1)}>
                  Reintentar
                </button>
                <Link href="/" className="remand-action remand-action-quiet">
                  Volver a primera instancia
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {data && (
        <>
          <section className="remand-enter pt-[var(--ma-section)]" style={{ "--delay": "0ms" } as React.CSSProperties}>
            <p className="remand-label">Apelante</p>
            <h1
              className="remand-num mt-[var(--ma-tight)]"
              style={{ fontSize: "clamp(1rem, 0.7rem + 1.6vw, 1.5rem)", wordBreak: "break-all" }}
            >
              {data.address}
            </h1>
            <p
              className="remand-num mt-[var(--ma-close)]"
              style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}
            >
              Evidencia observada hasta el bloque {Number(data.observedAtBlock).toLocaleString("es")} de Arbitrum One
            </p>

            {sinHistorial && (
              <div className="remand-sunk mt-[var(--ma-block)] p-[var(--ma-block)]">
                <p className="remand-label" style={{ color: "var(--ink)" }}>
                  Expediente sin materia
                </p>
                <p className="remand-prose mt-[var(--ma-tight)]">
                  Esta wallet no registra actividad de préstamo en Arbitrum One, así que no hay evidencia crediticia que
                  apelar. El fallo se emite igual, con las dimensiones en cero, porque el contrato no distingue entre un
                  historial limpio y la ausencia de historial.
                </p>
              </div>
            )}
          </section>

          <section
            className="remand-enter mt-[var(--ma-block)]"
            style={{ "--delay": "60ms" } as React.CSSProperties}
            aria-labelledby="evidencia-heading"
          >
            <h2 id="evidencia-heading" className="remand-label">
              Evidencia reunida en Arbitrum One
            </h2>
            <div className="mt-[var(--ma-close)]">
              <EvidenceGrid data={data} />
            </div>
            <div className="mt-[var(--ma-close)]">
              <CaseFingerprint evidence={data.evidence} />
            </div>
            <div className="mt-[var(--ma-block)]">
              <Procedencia apelante={address as `0x${string}`} evidencia={data.evidence} />
            </div>
          </section>

          <section
            className="remand-enter mt-[var(--ma-section)]"
            style={{ "--delay": "120ms" } as React.CSSProperties}
            aria-labelledby="agentes-heading"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-[var(--ma-close)]">
              <h2 id="agentes-heading" className="remand-label">
                Alegatos
              </h2>
              <p className="remand-label remand-label-long">
                {data.caseFile.source === "model"
                  ? "Redactados por los dos agentes · no afectan el puntaje"
                  : `Redactados sin agentes · ${data.caseFile.fallbackReason ?? "los agentes no estuvieron disponibles"}`}
              </p>
            </div>

            <div className="mt-[var(--ma-close)] grid gap-[var(--ma-close)] lg:grid-cols-2">
              <ArgumentList
                title="Agente defensor"
                meaning="Lo que la primera instancia pasó por alto"
                items={data.caseFile.defense}
                Glyph={ShieldChevron}
                tone="var(--granted)"
              />
              <ArgumentList
                title="Agente contraparte"
                meaning="Lo que un acreedor prudente objetaría"
                items={data.caseFile.challenges}
                Glyph={Scales}
                tone="var(--seal)"
              />
            </div>

            <p
              className="mt-[var(--ma-close)] flex items-start gap-[var(--ma-tight)]"
              style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)", maxWidth: "70ch" }}
            >
              <Gavel size={16} weight="light" aria-hidden="true" className="remand-glyph-inline" />
              Ningún agente decide. Los alegatos explican el expediente y no mueven el puntaje ni una centésima: el
              fallo lo computa el contrato con la evidencia de arriba.
            </p>
          </section>

          <section
            className="remand-enter mt-[var(--ma-chapter)]"
            style={{ "--delay": "180ms" } as React.CSSProperties}
          >
            <div className="remand-plate remand-verdict-plate" style={{ padding: "var(--ma-section) var(--ma-block)" }}>
              <Guilloche
                seed={data.caseId}
                size={260}
                className="remand-verdict-rosette remand-plate-ink"
                microtext={`expediente ${data.caseId.slice(0, 12)}`}
              />
              <div className="flex flex-wrap items-end justify-between gap-[var(--ma-block)]">
                <div>
                  <p className="remand-label">Puntaje del fallo</p>
                  <p className="remand-figure mt-[var(--ma-tight)]">
                    {bps(data.verdict.totalScore)}
                    <span style={{ fontSize: "0.28em", marginLeft: "0.08em" }}>%</span>
                  </p>
                </div>

                <div className="grid gap-[var(--ma-close)]">
                  <span className="remand-sealbox">
                    <Guilloche
                      seed={`${data.caseId}-fallo`}
                      size={104}
                      layers={3}
                      weight={0.55}
                      steps={480}
                      className="remand-sealbox-rosette"
                    />
                    <span
                      className={`remand-seal ${data.verdict.approved ? "remand-seal-granted" : "remand-seal-denied"}`}
                    >
                      {data.verdict.approved ? (
                        <CheckCircle size={15} weight="light" aria-hidden="true" />
                      ) : (
                        <Warning size={15} weight="light" aria-hidden="true" />
                      )}
                      {data.verdict.approved ? "Concedida" : "Denegada"}
                    </span>
                  </span>
                  <div>
                    <p className="remand-label">Colateral exigido tras el recálculo</p>
                    <p className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-lead)" }}>
                      {bps(data.verdict.collateralRequiredBps)}%
                      <span style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)", marginLeft: "0.6em" }}>
                        antes 120,00%
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <hr className="remand-rule" style={{ margin: "var(--ma-section) 0 var(--ma-block)" }} />

              <VerdictLedger verdict={data.verdict} weights={data.weights} />
            </div>

            {!data.verdict.approved && (
              <div className="mt-[var(--ma-close)]">
                <Shortfall verdict={data.verdict} weights={data.weights} />
              </div>
            )}
          </section>

          <section
            className="remand-enter mt-[var(--ma-section)]"
            style={{ "--delay": "200ms" } as React.CSSProperties}
            aria-labelledby="limites-heading"
          >
            <h2 id="limites-heading" className="remand-label">
              Alcance de la evidencia
            </h2>
            <div className="mt-[var(--ma-close)]">
              <EvidenceLimits />
            </div>
          </section>

          <section
            className="remand-enter mt-[var(--ma-section)]"
            style={{ "--delay": "220ms" } as React.CSSProperties}
            aria-labelledby="asentar-heading"
          >
            <h2 id="asentar-heading" className="remand-label">
              Registro del fallo
            </h2>
            <div className="mt-[var(--ma-close)]">
              <RegisterRuling
                appellant={data.address}
                caseId={BigInt(data.caseId)}
                evidence={data.evidence}
                alreadyJudged={data.alreadyJudged}
              />
            </div>
          </section>

          <section
            className="remand-enter mt-[var(--ma-section)]"
            style={{ "--delay": "260ms" } as React.CSSProperties}
            aria-labelledby="verificar-heading"
          >
            <h2 id="verificar-heading" className="remand-label">
              Comprobarlo por cuenta propia
            </h2>
            <p className="remand-prose mt-[var(--ma-close)]">
              El fallo lo calcula un contrato desplegado en Arbitrum Sepolia, la red de pruebas de Arbitrum, y no este
              servidor. La evidencia sí sale de Arbitrum One, la red real. Cualquiera puede ejecutar la misma función
              pública con estos datos, sin wallet y sin gas, y obtener estos mismos números.
            </p>
            <div className="mt-[var(--ma-block)] flex flex-wrap gap-[var(--ma-close)]">
              <Link
                href={`/verify?age=${data.evidence.walletAgeDays}&active=${data.evidence.activeMonths}&total=${data.evidence.totalMonths}&repaid=${data.evidence.repayments}&borrowed=${data.evidence.borrows}&liq=${data.evidence.liquidations}&protocols=${data.evidence.distinctProtocols}&expect=${data.verdict.totalScore}&from=${data.address}`}
                className="remand-action"
              >
                <SealCheck size={16} weight="light" aria-hidden="true" />
                Abrir el verificador
              </Link>
              <a
                href={`${ARBISCAN_BASE}/address/${REMAND_VERDICT_ADDRESS}#readContract`}
                target="_blank"
                rel="noopener noreferrer"
                className="remand-action remand-action-quiet"
              >
                Leer el contrato que emitió este fallo
                <ArrowUpRight size={16} weight="light" aria-hidden="true" />
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </div>
          </section>
        </>
      )}
    </Docket>
  );
}
