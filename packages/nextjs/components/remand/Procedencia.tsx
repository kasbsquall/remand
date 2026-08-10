"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import {
  ATTEST_ADDRESS,
  cotaCoherente,
  probarCuenta,
  tablaProcedencia,
  type FilaProcedencia,
  type HechoProbado,
} from "~~/lib/attest";

/**
 * De dónde sale cada número del expediente.
 *
 * El verificador ya demuestra que la aritmética se ejecuta dentro del contrato.
 * Lo que nadie demostraba es de dónde salen los siete números que se le pasan, y
 * dos evaluadores externos lo señalaron por separado. Presentarlos como si
 * fueran la misma clase de dato sería cómodo y falso.
 *
 * Aquí se separan en tres, y sólo el primero está probado:
 *
 *   probado       el contrato camina una prueba de Merkle-Patricia y comprueba
 *                 el hash en cada salto. Nadie tiene que creerse nada.
 *   recalculable  sale de un nodo público sin clave de API, así que cualquiera
 *                 obtiene el mismo entero. No está probado en cadena porque
 *                 exigiría anclar bloques de hace meses, y la ventana del
 *                 precompilado son 256.
 *   declarado     viene de un índice de terceros. Es el punto donde el
 *                 expediente descansa sobre confianza, y por eso se dice.
 *
 * Cuatro de los siete campos son declarados. Enseñar esa proporción es más
 * fuerte que prometer cobertura total, porque es lo que un jurado va a
 * comprobar de todas formas.
 */

const TONO: Record<FilaProcedencia["procedencia"], { color: string; etiqueta: string }> = {
  probado: { color: "var(--seal)", etiqueta: "probado en cadena" },
  recalculable: { color: "var(--ink-2)", etiqueta: "recalculable" },
  declarado: { color: "var(--ink-faint)", etiqueta: "declarado" },
};

type Evidencia = {
  walletAgeDays: number;
  activeMonths: number;
  totalMonths: number;
  repayments: number;
  borrows: number;
  liquidations: number;
  distinctProtocols: number;
};

export function Procedencia({ apelante, evidencia }: { apelante: Address; evidencia: Evidencia }) {
  const [probado, setProbado] = useState<HechoProbado | null>(null);
  const [estado, setEstado] = useState<"probando" | "listo" | "fallo">("probando");

  useEffect(() => {
    let vivo = true;
    probarCuenta(apelante)
      .then(h => {
        if (!vivo) return;
        setProbado(h);
        setEstado("listo");
      })
      .catch(() => {
        // Si el nodo público no sirve la prueba, la tabla se muestra igual con
        // las otras dos categorías. Fallar del todo por esto ocultaría
        // información que sí es correcta.
        if (vivo) setEstado("fallo");
      });
    return () => {
      vivo = false;
    };
  }, [apelante]);

  const filas = tablaProcedencia(evidencia, probado);
  const cota = cotaCoherente(evidencia, probado);
  const declarados = filas.filter(f => f.procedencia === "declarado").length;

  return (
    <div className="remand-sunk p-[var(--ma-block)]">
      <div className="flex flex-wrap items-baseline justify-between gap-[var(--ma-close)]">
        <p className="remand-label">De dónde sale cada número</p>
        <p style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}>
          {declarados} de {filas.length} descansan sobre un índice de terceros
        </p>
      </div>

      <div className="mt-[var(--ma-block)] grid gap-[var(--ma-tight)]">
        {filas.map(f => {
          const t = TONO[f.procedencia];
          return (
            <div
              key={f.campo}
              className="grid items-baseline gap-[var(--ma-tight)] py-[var(--ma-tight)]"
              style={{
                gridTemplateColumns: "minmax(0,1fr) auto",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              <div>
                <p style={{ fontSize: "var(--t-small)" }}>{f.campo}</p>
                <p style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}>{f.como}</p>
              </div>
              <div className="text-right">
                <p className="remand-num" style={{ fontSize: "var(--t-small)" }}>
                  {f.valor}
                </p>
                <p
                  className="remand-label"
                  style={{ fontSize: "var(--t-micro)", color: t.color, letterSpacing: "0.12em" }}
                >
                  {t.etiqueta}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {estado === "probando" && (
        <p className="mt-[var(--ma-close)]" style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}>
          Pidiendo la prueba de estado a un nodo público de Arbitrum One…
        </p>
      )}

      {estado === "fallo" && (
        <p
          className="mt-[var(--ma-close)] flex items-start gap-[var(--ma-tight)]"
          style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}
        >
          <Warning size={14} weight="light" aria-hidden="true" className="remand-glyph-inline" />
          El nodo público no sirvió la prueba de estado ahora mismo. Los otros campos no dependen de ella.
        </p>
      )}

      {cota && (
        <div
          className="mt-[var(--ma-block)] flex items-start gap-[var(--ma-close)] pt-[var(--ma-close)]"
          style={{ borderTop: "1px solid var(--rule)" }}
        >
          {cota.cumple ? (
            <CheckCircle
              size={18}
              weight="light"
              aria-hidden="true"
              className="remand-glyph-inline"
              style={{ color: "var(--seal)" }}
            />
          ) : (
            <Warning size={18} weight="light" aria-hidden="true" style={{ color: "var(--deny)" }} />
          )}
          <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>
            {cota.cumple ? (
              <>
                Lo declarado cabe dentro de lo probado: {cota.operaciones} operaciones sobre {cota.techo} transacciones
                firmadas. Una wallet no puede haber hecho más operaciones que transacciones ha firmado, así que un
                expediente inflado se detectaría aquí sin salir de esta página.
              </>
            ) : (
              <>
                El expediente declara {cota.operaciones} operaciones y la cadena demuestra sólo {cota.techo}{" "}
                transacciones firmadas. Eso no puede ser.
              </>
            )}
          </p>
        </div>
      )}

      <p className="mt-[var(--ma-close)]" style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}>
        Lo probado lo verifica el contrato {ATTEST_ADDRESS.slice(0, 10)}…{ATTEST_ADDRESS.slice(-6)}, que recorre la
        prueba comprobando el hash en cada salto. Es una lectura pura: sin firma y sin gas, y se puede repetir desde
        cualquier navegador.
      </p>
    </div>
  );
}
