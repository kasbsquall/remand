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
import { Docket } from "~~/components/remand/Docket";
import { VerdictLedger, type Weights } from "~~/components/remand/VerdictLedger";
import { bps, type Verdict } from "~~/lib/contract";
import type { Argument, CaseFile } from "~~/lib/agents";
import type { Evidence, Provenance } from "~~/lib/evidence/collector";

type AppealResponse = {
  address: string;
  evidence: Evidence;
  provenance: Record<keyof Evidence, Provenance>;
  truncated: (keyof Evidence)[];
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
            {unavailable && <p style={{ fontSize: "var(--t-micro)", color: "var(--seal)" }}>no medible</p>}
            {isTruncated && <p style={{ fontSize: "var(--t-micro)", color: "var(--seal)" }}>mínimo, conteo truncado</p>}
          </div>
        );
      })}

      {/* Octava celda: cierra la rejilla de cuatro columnas y declara de donde
          salio el dato. Sin ella quedaba un hueco relleno que se leia como un
          fallo de maquetacion. */}
      <div
        className="remand-enter p-[var(--ma-close)]"
        style={{ background: "var(--paper-raised)", "--delay": "210ms" } as React.CSSProperties}
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
              <span className="remand-num" style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}>
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
  }, [address]);

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <Docket reference={`Apelación · ${short}`}>
      {!data && !error && <LoadingDocket />}

      {error && (
        <div className="remand-sunk mt-[var(--ma-section)] p-[var(--ma-block)]" role="alert">
          <div className="flex items-start gap-[var(--ma-tight)]">
            <Warning size={20} weight="light" aria-hidden="true" style={{ color: "var(--denied)" }} />
            <div>
              <p className="remand-label" style={{ color: "var(--ink)" }}>
                No se pudo abrir el expediente
              </p>
              <p className="remand-prose mt-[var(--ma-tight)]">{error}</p>
              <Link href="/" className="remand-action remand-action-quiet mt-[var(--ma-block)]">
                Volver a primera instancia
              </Link>
            </div>
          </div>
        </div>
      )}

      {data && (
        <>
          <section className="pt-[var(--ma-section)]">
            <p className="remand-label">Apelante</p>
            <h1
              className="remand-num mt-[var(--ma-tight)]"
              style={{ fontSize: "clamp(1rem, 0.7rem + 1.6vw, 1.5rem)", wordBreak: "break-all" }}
            >
              {data.address}
            </h1>
          </section>

          <section className="mt-[var(--ma-section)]" aria-labelledby="evidencia-heading">
            <h2 id="evidencia-heading" className="remand-label">
              Evidencia reunida en Arbitrum One
            </h2>
            <div className="mt-[var(--ma-close)]">
              <EvidenceGrid data={data} />
            </div>
          </section>

          <section className="mt-[var(--ma-section)]" aria-labelledby="agentes-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-[var(--ma-close)]">
              <h2 id="agentes-heading" className="remand-label">
                Alegatos
              </h2>
              <p className="remand-label" style={{ letterSpacing: "0.08em" }}>
                {data.caseFile.source === "model"
                  ? "Redactados por agentes"
                  : `Análisis determinista · ${data.caseFile.fallbackReason ?? "sin modelo"}`}
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
              <Gavel size={16} weight="light" aria-hidden="true" style={{ marginTop: "0.15rem", flexShrink: 0 }} />
              Ningún agente decide. Los alegatos no alteran el fallo ni en un punto base: el veredicto lo computa el
              contrato a partir de la evidencia de arriba.
            </p>
          </section>

          <section className="mt-[var(--ma-section)]">
            <div className="remand-sheet p-[var(--ma-block)]">
              <div className="flex flex-wrap items-end justify-between gap-[var(--ma-block)]">
                <div>
                  <p className="remand-label">Puntaje recalculado</p>
                  <p className="remand-figure mt-[var(--ma-tight)]">
                    {bps(data.verdict.totalScore)}
                    <span style={{ fontSize: "0.28em", marginLeft: "0.08em" }}>%</span>
                  </p>
                </div>

                <div className="grid gap-[var(--ma-close)]">
                  <span
                    className={`remand-seal ${data.verdict.approved ? "remand-seal-granted" : "remand-seal-denied"}`}
                  >
                    {data.verdict.approved ? (
                      <CheckCircle size={15} weight="light" aria-hidden="true" />
                    ) : (
                      <Warning size={15} weight="light" aria-hidden="true" />
                    )}
                    {data.verdict.approved ? "Apelación concedida" : "Apelación denegada"}
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

              <hr className="remand-rule my-[var(--ma-block)]" />

              <VerdictLedger verdict={data.verdict} weights={data.weights} />
            </div>
          </section>

          <section className="mt-[var(--ma-section)]" aria-labelledby="verificar-heading">
            <h2 id="verificar-heading" className="remand-label">
              Comprobarlo por cuenta propia
            </h2>
            <p className="remand-prose mt-[var(--ma-close)]">
              Este fallo se calculó dentro del contrato en Arbitrum, no en este servidor. La misma función es una vista
              pública: cualquiera puede ejecutarla con esta evidencia, sin wallet y sin gas, y obtener estos mismos
              números.
            </p>
            <div className="mt-[var(--ma-block)] flex flex-wrap gap-[var(--ma-close)]">
              <Link
                href={`/verify?age=${data.evidence.walletAgeDays}&active=${data.evidence.activeMonths}&total=${data.evidence.totalMonths}&repaid=${data.evidence.repayments}&borrowed=${data.evidence.borrows}&liq=${data.evidence.liquidations}&protocols=${data.evidence.distinctProtocols}`}
                className="remand-action"
              >
                <SealCheck size={16} weight="light" aria-hidden="true" />
                Abrir el verificador
              </Link>
              <a
                href={`https://sepolia.arbiscan.io/address/0xc6af1f2893f9b3d4547ff31ee1e9181597e2850a#readContract`}
                target="_blank"
                rel="noopener noreferrer"
                className="remand-action remand-action-quiet"
              >
                Leer el contrato en Arbiscan
                <ArrowUpRight size={15} weight="light" aria-hidden="true" />
              </a>
            </div>
          </section>
        </>
      )}
    </Docket>
  );
}
