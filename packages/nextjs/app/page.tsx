"use client";

/**
 * Primera instancia.
 *
 * Plantea el problema con el mecanismo real y no con una lámina de marketing:
 * la evaluación por colateral no mira comportamiento, así que exige 120% a todo
 * el mundo por igual y rechaza a quien no tiene capital acumulado. Desde aquí se
 * abre la apelación.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Prohibit, Warning } from "@phosphor-icons/react";
import { isAddress } from "viem";
import { Docket, docketNumber } from "~~/components/remand/Docket";

/** Wallet de un prestatario real de Aave V3 en Arbitrum, para probar la demo. */
const EJEMPLO = "0x39c7e5be19f99b178e38aa06f7799d517be89e92";

export default function PrimeraInstancia() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = address.trim();
    if (!isAddress(value)) {
      setError("Una dirección válida empieza con 0x y tiene 42 caracteres. Revisa que la hayas copiado completa.");
      document.getElementById("wallet")?.focus();
      return;
    }
    setError(null);
    router.push(`/appeal/${value}`);
  };

  return (
    <Docket reference={docketNumber("I")}>
      <section className="pt-[var(--ma-section)]">
        <p className="remand-label remand-enter">El problema</p>

        <h1
          className="remand-display remand-enter mt-[var(--ma-close)]"
          style={{ fontSize: "var(--t-title)", maxWidth: "22ch", "--delay": "60ms" } as React.CSSProperties}
        >
          En crédito descentralizado te niegan un préstamo y no hay a quién reclamarle.
        </h1>

        <p
          className="remand-prose remand-enter mt-[var(--ma-block)]"
          style={{ "--delay": "120ms" } as React.CSSProperties}
        >
          La primera instancia mira una sola cosa: cuánto capital puedes inmovilizar. No mira si devolviste lo que
          pediste, ni hace cuánto operas, ni si sostuviste posiciones sin caerte. Quien no acumuló capital queda fuera,
          aunque su historial diga lo contrario.
        </p>
      </section>

      <section
        className="remand-enter mt-[var(--ma-section)]"
        style={{ "--delay": "180ms" } as React.CSSProperties}
        aria-labelledby="primera-heading"
      >
        <h2 id="primera-heading" className="remand-label">
          Cómo falla la primera instancia
        </h2>

        <div className="remand-sunk mt-[var(--ma-close)] p-[var(--ma-block)]">
          <div className="flex flex-wrap items-end justify-between gap-[var(--ma-block)]">
            <div>
              <p className="remand-label">Colateral exigido</p>
              <p className="remand-figure mt-[var(--ma-tight)]" style={{ color: "var(--denied)" }}>
                120<span style={{ fontSize: "0.32em", marginLeft: "0.1em" }}>%</span>
              </p>
              <p
                className="mt-[var(--ma-close)]"
                style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)", maxWidth: "34ch" }}
              >
                Sobre el monto solicitado, según los parámetros de Aave V3 en Arbitrum. Idéntico para toda wallet, con
                historial o sin él.
              </p>
            </div>

            <ul className="grid gap-[var(--ma-close)]" style={{ minWidth: "min(100%, 20rem)" }}>
              <li className="flex items-start gap-[var(--ma-tight)]">
                <Prohibit
                  size={16}
                  weight="light"
                  aria-hidden="true"
                  className="remand-glyph-inline"
                  style={{ color: "var(--ink-faint)" }}
                />
                <span style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>No pondera repagos previos</span>
              </li>
              <li className="flex items-start gap-[var(--ma-tight)]">
                <Prohibit
                  size={16}
                  weight="light"
                  aria-hidden="true"
                  className="remand-glyph-inline"
                  style={{ color: "var(--ink-faint)" }}
                />
                <span style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>
                  No pondera antigüedad ni constancia
                </span>
              </li>
              <li className="flex items-start gap-[var(--ma-tight)]">
                <Warning
                  size={16}
                  weight="light"
                  aria-hidden="true"
                  className="remand-glyph-inline"
                  style={{ color: "var(--seal)" }}
                />
                <span style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>
                  El cálculo ocurre fuera de la cadena y no se puede reproducir
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section
        className="remand-enter mt-[var(--ma-section)]"
        style={{ "--delay": "240ms" } as React.CSSProperties}
        aria-labelledby="apelar-heading"
      >
        <h2 id="apelar-heading" className="remand-label">
          Abrir apelación
        </h2>
        <p className="remand-prose mt-[var(--ma-close)]">
          La segunda instancia reúne la evidencia de comportamiento que la primera ignoró y recalcula el fallo dentro de
          un contrato en Arbitrum. Queda escrito con su desglose completo, y cualquiera puede reproducirlo.
        </p>

        <form onSubmit={handleSubmit} className="mt-[var(--ma-block)]" noValidate>
          <label htmlFor="wallet" className="remand-label">
            Wallet del apelante
          </label>
          <div className="mt-[var(--ma-tight)] flex flex-col gap-[var(--ma-close)] sm:flex-row">
            <input
              id="wallet"
              name="wallet"
              className="remand-field"
              placeholder="0x…"
              value={address}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "wallet-error" : "wallet-hint"}
              onChange={event => {
                setAddress(event.target.value);
                if (error) setError(null);
              }}
            />
            <button type="submit" className="remand-action" style={{ whiteSpace: "nowrap" }}>
              Reunir evidencia
              <ArrowRight size={16} weight="light" aria-hidden="true" />
            </button>
          </div>

          {error ? (
            <p
              id="wallet-error"
              role="alert"
              className="mt-[var(--ma-tight)]"
              style={{ fontSize: "var(--t-small)", color: "var(--denied)" }}
            >
              {error}
            </p>
          ) : (
            <p
              id="wallet-hint"
              className="mt-[var(--ma-tight)]"
              style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}
            >
              Reunir la evidencia y calcular el fallo no exige firma: se lee historial público. Asentarlo en la cadena
              sí, y sólo puede hacerlo el dueño de la wallet.{" "}
              <button
                type="button"
                className="remand-link"
                style={{
                  background: "none",
                  border: 0,
                  font: "inherit",
                  cursor: "pointer",
                  padding: "0.5rem 0",
                  marginBlock: "-0.5rem",
                  minHeight: "44px",
                  display: "inline-flex",
                  alignItems: "center",
                }}
                onClick={() => {
                  setAddress(EJEMPLO);
                  setError(null);
                }}
              >
                Probar con una wallet de ejemplo
              </button>
            </p>
          )}
        </form>
      </section>
    </Docket>
  );
}
