"use client";

/**
 * Asentar el fallo en la cadena.
 *
 * Hasta aquí el fallo está calculado pero no registrado: `previewVerdict` es una
 * vista y no deja rastro. Este paso llama a `submitAppeal`, que guarda el
 * desglose completo en el contrato y emite los eventos del expediente. A partir
 * de ese momento el fallo existe aunque esta aplicación desaparezca.
 *
 * El contrato usa `msg_sender()` como apelante, así que sólo el dueño de la
 * wallet puede asentar su propio expediente. Eso no es una limitación técnica
 * que haya que disculpar: es la regla que impide que un tercero abra
 * expedientes a nombre ajeno.
 */

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle, FileText, Warning } from "@phosphor-icons/react";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { ARBISCAN_BASE, caseRef, remandAbi, REMAND_VERDICT_ADDRESS, type EvidenceInput } from "~~/lib/contract";
import { ConnectButton } from "@rainbow-me/rainbowkit";

type Props = {
  /** Wallet cuyo historial se evaluó. Sólo ella puede asentar este fallo. */
  appellant: string;
  /** Número de expediente, derivado de la dirección y del bloque de corte. */
  caseId: bigint;
  evidence: EvidenceInput;
  /** Si el expediente ya estaba asentado antes de abrir esta página. */
  alreadyJudged: boolean;
};

function Aviso({ children, tone = "faint" }: { children: React.ReactNode; tone?: "faint" | "seal" }) {
  return (
    <p
      style={{
        fontSize: "var(--t-small)",
        color: tone === "seal" ? "var(--seal)" : "var(--ink-faint)",
        maxWidth: "58ch",
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}

export function RegisterRuling({ appellant, caseId, evidence, alreadyJudged }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [asentado, setAsentado] = useState(alreadyJudged);

  useEffect(() => {
    if (isSuccess) setAsentado(true);
  }, [isSuccess]);

  const esLaWalletCorrecta = address?.toLowerCase() === appellant.toLowerCase();
  const esLaRedCorrecta = chainId === arbitrumSepolia.id;

  const asentar = () => {
    reset();
    writeContract({
      address: REMAND_VERDICT_ADDRESS,
      abi: remandAbi,
      functionName: "submitAppeal",
      args: [
        caseId,
        evidence.walletAgeDays,
        evidence.activeMonths,
        evidence.totalMonths,
        evidence.repayments,
        evidence.borrows,
        evidence.liquidations,
        evidence.distinctProtocols,
      ],
    });
  };

  // ── Ya asentado ───────────────────────────────────────────────────────────
  if (asentado) {
    return (
      <div className="remand-sunk p-[var(--ma-block)]">
        <div className="flex items-start gap-[var(--ma-close)]">
          <CheckCircle
            size={20}
            weight="light"
            aria-hidden="true"
            style={{ color: "var(--granted)", flexShrink: 0, marginTop: "0.1rem" }}
          />
          <div>
            <p className="remand-label" style={{ color: "var(--ink)" }}>
              Fallo asentado en Arbitrum
            </p>
            <p className="remand-prose mt-[var(--ma-tight)]">
              El desglose completo está registrado en el contrato y ya no depende de esta página. Cualquiera puede
              leerlo llamando a <span className="remand-num">getRuling</span> con el número de expediente.
            </p>
            {txHash && (
              <a
                href={`${ARBISCAN_BASE}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="remand-link remand-num mt-[var(--ma-close)] inline-flex items-center gap-[var(--ma-hair)]"
                style={{ fontSize: "var(--t-small)" }}
              >
                {txHash.slice(0, 18)}…{txHash.slice(-6)}
                <ArrowUpRight size={16} weight="light" aria-hidden="true" />
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Aún sin asentar ───────────────────────────────────────────────────────
  return (
    <div className="remand-sunk p-[var(--ma-block)]">
      <div className="flex items-start gap-[var(--ma-close)]">
        <FileText
          size={20}
          weight="light"
          aria-hidden="true"
          style={{ color: "var(--seal)", flexShrink: 0, marginTop: "0.1rem" }}
        />
        <div style={{ width: "100%" }}>
          <p className="remand-label" style={{ color: "var(--ink)" }}>
            Asentar el fallo en Arbitrum
          </p>
          <p className="remand-prose mt-[var(--ma-tight)]">
            El fallo de arriba está calculado, pero todavía no registrado. Al asentarlo queda escrito en el contrato con
            su desglose completo y su número de expediente, y deja de depender de que esta página siga existiendo.
          </p>

          <dl className="mt-[var(--ma-block)] grid gap-[var(--ma-close)] sm:grid-cols-2">
            <div>
              <dt className="remand-label">Expediente</dt>
              <dd
                className="remand-num mt-[var(--ma-hair)]"
                style={{ fontSize: "var(--t-lead)" }}
                title={caseId.toString()}
              >
                {caseRef(caseId)}
              </dd>
            </div>
            <div>
              <dt className="remand-label">Red</dt>
              <dd className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-small)" }}>
                Arbitrum Sepolia · red de pruebas
              </dd>
            </div>
          </dl>

          <div className="mt-[var(--ma-block)]">
            {!isConnected && (
              <>
                <ConnectButton.Custom>
                  {({ openConnectModal, mounted }) => (
                    <button type="button" className="remand-action" onClick={openConnectModal} disabled={!mounted}>
                      Conectar wallet para asentar
                    </button>
                  )}
                </ConnectButton.Custom>
                <div className="mt-[var(--ma-close)]">
                  <Aviso>
                    Reunir la evidencia y calcular el fallo no exige firma. Asentarlo sí, y sólo puede hacerlo el dueño
                    de la wallet apelante.
                  </Aviso>
                </div>
              </>
            )}

            {isConnected && !esLaWalletCorrecta && (
              <>
                <button type="button" className="remand-action" disabled>
                  Asentar el fallo
                </button>
                <div className="mt-[var(--ma-close)]">
                  <Aviso tone="seal">
                    Este expediente pertenece a {appellant.slice(0, 8)}…{appellant.slice(-6)}. Sólo esa wallet puede
                    asentar su propio fallo, porque el contrato registra a quien firma como apelante.
                  </Aviso>
                </div>
              </>
            )}

            {isConnected && esLaWalletCorrecta && !esLaRedCorrecta && (
              <button
                type="button"
                className="remand-action"
                onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
              >
                Cambiar a Arbitrum Sepolia
              </button>
            )}

            {isConnected && esLaWalletCorrecta && esLaRedCorrecta && (
              <>
                <button type="button" className="remand-action" onClick={asentar} disabled={isPending || isMining}>
                  {isPending ? "Confirma en tu wallet…" : isMining ? "Asentando en la cadena…" : "Asentar el fallo"}
                </button>
                {txHash && isMining && (
                  <div className="mt-[var(--ma-close)]">
                    <Aviso>Transacción enviada. Arbitrum suele confirmar en pocos segundos.</Aviso>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="mt-[var(--ma-close)]" role="alert">
                <div className="flex items-start gap-[var(--ma-tight)]">
                  <Warning
                    size={16}
                    weight="light"
                    aria-hidden="true"
                    className="remand-glyph-inline"
                    style={{ color: "var(--denied)" }}
                  />
                  <Aviso>
                    {/^user rejected|denied transaction/i.test(error.message)
                      ? "Cancelaste la firma. El fallo sigue calculado, sólo que sin asentar."
                      : "No se pudo asentar el fallo. Revisa que la wallet tenga algo de ETH de prueba para el gas y vuelve a intentarlo."}
                  </Aviso>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
