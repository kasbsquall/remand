/**
 * Armazón del expediente.
 *
 * Da el marco de acta a todas las vistas: cabecera con la referencia del
 * expediente, pauta superior, grano de papel y pie con la dirección del
 * contrato. La dirección va en el pie de todas las pantallas a propósito: es el
 * dato que permite a cualquiera ir a comprobar lo que la interfaz afirma.
 */

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { RemandLockup } from "~~/components/remand/RemandMark";
import { ARBISCAN_BASE, REMAND_VERDICT_ADDRESS } from "~~/lib/contract";

/**
 * Referencia del expediente: año, sección y sufijo de la wallet cuando la hay.
 * Un acta se identifica por un número, no por el título de su pantalla.
 */
export function docketNumber(section: string, address?: string): string {
  const year = new Date().getUTCFullYear();
  const tail = address ? address.slice(-4).toUpperCase() : "0000";
  return `REMAND · ${year} · ${section} · ${tail}`;
}

function FiledAt({ filed }: { filed?: Date }) {
  const stamped = filed ?? new Date();
  const fecha = stamped.toLocaleDateString("es", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
  const hora = stamped.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return (
    <time
      className="remand-num"
      dateTime={stamped.toISOString()}
      style={{
        display: "block",
        fontSize: "var(--t-micro)",
        color: "var(--ink-faint)",
        marginTop: "var(--ma-hair)",
      }}
    >
      {fecha} · {hora} UTC
    </time>
  );
}

export function Docket({
  reference,
  filed,
  children,
}: {
  /** Referencia del expediente, en la esquina superior derecha. */
  reference: string;
  /** Momento de la lectura. Un acta sin fecha no es un acta. */
  filed?: Date;
  children: React.ReactNode;
}) {
  return (
    <div className="remand relative min-h-[100dvh]">
      <div className="remand-grain" aria-hidden="true" />
      <div className="remand-watermark" aria-hidden="true">
        REMAND
      </div>

      <div className="relative z-[1] mx-auto w-full max-w-5xl px-[var(--ma-block)] pb-[var(--ma-chapter)]">
        <header
          className="flex flex-wrap items-center justify-between gap-[var(--ma-close)] py-[var(--ma-block)]"
          style={{ borderBottom: "1px solid var(--rule-strong)" }}
        >
          <Link
            href="/"
            className="remand-link inline-flex items-baseline gap-[var(--ma-close)]"
            style={{ textDecoration: "none" }}
          >
            <RemandLockup markSize={26} wordSize="var(--t-body)" />
            <span
              className="remand-label sr-only sm:not-sr-only"
              style={{ alignSelf: "flex-end", paddingBottom: "0.15em" }}
            >
              Segunda instancia del crédito on-chain
            </span>
          </Link>
          <div style={{ textAlign: "right" }}>
            <p className="remand-label remand-num">{reference}</p>
            <FiledAt filed={filed} />
          </div>
        </header>

        <main>{children}</main>
      </div>

      <footer
        className="relative z-[1] mx-auto w-full max-w-5xl px-[var(--ma-block)] pb-[var(--ma-block)]"
        style={{ borderTop: "1px solid var(--rule)" }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-[var(--ma-close)] pt-[var(--ma-close)]">
          <p className="remand-label">Contrato del veredicto · Arbitrum Sepolia, red de pruebas</p>
          <a
            href={`${ARBISCAN_BASE}/address/${REMAND_VERDICT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="remand-link remand-num inline-flex items-center gap-[var(--ma-hair)]"
            style={{ fontSize: "var(--t-small)" }}
          >
            {REMAND_VERDICT_ADDRESS}
            <ArrowUpRight size={16} weight="light" aria-hidden="true" />
            <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
