/**
 * Los dos agentes de la apelación.
 *
 * El Defensor arma el caso a partir de la evidencia recolectada. La Contraparte
 * lo revisa y señala sus debilidades. Ninguno de los dos decide nada: el fallo
 * lo computa el contrato Stylus, de forma determinista, y los agentes no lo
 * pueden mover ni un punto base.
 *
 * Esa separación es lo que hace verificable al sistema. Si el veredicto saliera
 * de un modelo de lenguaje, dos ejecuciones con la misma evidencia podrían dar
 * resultados distintos y nadie podría reproducir un rechazo. Los agentes aportan
 * lo que un cálculo no da, que es contexto y contradicción, y se quedan fuera de
 * la parte que tiene que ser reproducible.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { CollectedEvidence } from "../evidence/collector";

/** Modelo usado por ambos agentes. */
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 700;

export type AgentSource = "model" | "deterministic";

export type Argument = {
  /** Una línea que resume el punto. */
  headline: string;
  /** Desarrollo del punto, apoyado sólo en la evidencia recibida. */
  detail: string;
  /** Dimensión de la evidencia que sostiene el punto. */
  dimension: keyof CollectedEvidence["evidence"];
};

export type CaseFile = {
  defense: Argument[];
  challenges: Argument[];
  /** Si los textos vienen del modelo o del respaldo determinista. */
  source: AgentSource;
  /** Motivo por el que se usó el respaldo, cuando aplica. */
  fallbackReason?: string;
};

const DIMENSION_LABELS: Record<keyof CollectedEvidence["evidence"], string> = {
  walletAgeDays: "antigüedad de la wallet",
  activeMonths: "meses con actividad",
  totalMonths: "meses desde la primera transacción",
  repayments: "repagos registrados",
  borrows: "préstamos tomados",
  liquidations: "liquidaciones sufridas",
  distinctProtocols: "contratos distintos usados",
};

/**
 * Contexto común a ambos agentes.
 *
 * Se les entrega la evidencia y se les prohíbe expresamente inventar datos o
 * emitir un veredicto. Un agente que se atribuya la decisión rompería la tesis
 * del proyecto en la propia interfaz.
 */
function buildContext(collected: CollectedEvidence, truncatedNote: string): string {
  const rows = Object.entries(collected.evidence)
    .map(([key, value]) => {
      const label = DIMENSION_LABELS[key as keyof CollectedEvidence["evidence"]];
      const origin = collected.provenance[key as keyof CollectedEvidence["evidence"]];
      const originNote = origin === "unavailable" ? " (no medible con la fuente disponible)" : "";
      return `- ${label}: ${value}${originNote}`;
    })
    .join("\n");

  return `Wallet apelante: ${collected.address}

Evidencia recolectada de su historial en Arbitrum:
${rows}${truncatedNote}`;
}

const SHARED_RULES = `Reglas que no puedes romper:
- Usa unicamente los numeros de la evidencia. No inventes datos, montos, fechas ni protocolos.
- No emitas un fallo ni digas si el prestamo deberia aprobarse. Eso lo calcula un contrato.
- Si una dimension figura como no medible, puedes senalar el vacio, pero no supongas su valor.
- Escribe en espanol neutro, directo, sin adjetivos de relleno y sin emojis.
- No uses guion largo como separador.

Responde solo con un objeto JSON valido, sin texto alrededor, con esta forma:
{"points": [{"headline": "...", "detail": "...", "dimension": "<clave exacta de la evidencia>"}]}
Entre dos y cuatro puntos.`;

const DEFENDER_ROLE = `Eres el agente defensor de una apelacion de credito on-chain.
Tu trabajo es construir el mejor caso honesto a favor del apelante a partir de su
comportamiento real en la cadena, senalando lo que una evaluacion que solo mira
colateral y saldo habria pasado por alto.`;

const COUNTERPARTY_ROLE = `Eres el agente contraparte de una apelacion de credito on-chain.
Tu trabajo es encontrar las debilidades del expediente para que la apelacion no
sea una defensa complaciente. Senala lo que un acreedor prudente objetaria: vacios
de evidencia, actividad concentrada en poco tiempo, historial corto, senales
ausentes. Sé exigente pero no injusto: no inventes defectos que la evidencia no
respalda.`;

function parsePoints(raw: string, collected: CollectedEvidence): Argument[] {
  // El modelo puede envolver el JSON en texto pese a la instrucción. Se extrae
  // el primer objeto y se descartan los puntos que citen una dimensión que no
  // existe: un argumento apoyado en un campo inventado no es admisible.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("El agente no devolvió JSON");

  const parsed = JSON.parse(match[0]) as { points?: unknown };
  if (!Array.isArray(parsed.points)) throw new Error("El agente no devolvió puntos");

  const validKeys = Object.keys(collected.evidence);
  return parsed.points
    .filter((point): point is Argument => {
      if (typeof point !== "object" || point === null) return false;
      const candidate = point as Partial<Argument>;
      return (
        typeof candidate.headline === "string" &&
        typeof candidate.detail === "string" &&
        typeof candidate.dimension === "string" &&
        validKeys.includes(candidate.dimension)
      );
    })
    .slice(0, 4);
}

async function runAgent(
  client: Anthropic,
  role: string,
  context: string,
  collected: CollectedEvidence,
): Promise<Argument[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: `${role}\n\n${SHARED_RULES}`,
    messages: [{ role: "user", content: context }],
  });

  const text = response.content
    .filter(block => block.type === "text")
    .map(block => (block as { text: string }).text)
    .join("");

  return parsePoints(text, collected);
}

/** Concuerda el sustantivo con la cifra. "3 prestamo(s)" es descuido, no economia. */
function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

/**
 * Argumentos deterministas, sin modelo.
 *
 * Existen para que la aplicación siga funcionando si la clave del modelo falta o
 * su servicio falla. Son más secos que los del agente, pero dicen la verdad
 * sobre los mismos números, y la interfaz avisa que vienen de aquí. Una demo que
 * se cae porque un servicio externo no respondió no demuestra nada.
 */
function deterministicCase(collected: CollectedEvidence): {
  defense: Argument[];
  challenges: Argument[];
} {
  const e = collected.evidence;
  const defense: Argument[] = [];
  const challenges: Argument[] = [];

  if (e.walletAgeDays >= 365) {
    defense.push({
      headline: `La wallet opera hace ${plural(Math.floor(e.walletAgeDays / 365), "año", "años")}`,
      detail: `Su primera transacción fue hace ${e.walletAgeDays} días. La permanencia es evidencia que una evaluación basada en saldo no registra.`,
      dimension: "walletAgeDays",
    });
  } else {
    challenges.push({
      headline: "Historial corto",
      detail: `La wallet tiene ${e.walletAgeDays} días de actividad. Es poco recorrido para inferir comportamiento sostenido.`,
      dimension: "walletAgeDays",
    });
  }

  if (e.borrows > 0 && e.repayments === e.borrows) {
    defense.push({
      headline: "Devolvió todo lo que pidió prestado",
      detail: `Registra ${plural(e.borrows, "préstamo", "préstamos")} y ${plural(e.repayments, "repago", "repagos")} en protocolos de préstamo. Es la señal más directa de cumplimiento.`,
      dimension: "repayments",
    });
  } else if (e.borrows === 0) {
    challenges.push({
      headline: "Sin historial crediticio",
      detail:
        "No registra préstamos previos, así que no hay evidencia de repago que ponderar. La ausencia no es un defecto, pero tampoco es un mérito.",
      dimension: "borrows",
    });
  }

  if (e.liquidations > 0) {
    challenges.push({
      headline: `Registra ${plural(e.liquidations, "liquidación", "liquidaciones")}`,
      detail:
        "Una posición liquidada indica que la wallet no cubrió su colateral a tiempo. Es el antecedente más adverso del expediente.",
      dimension: "liquidations",
    });
  }

  if (e.totalMonths > 0) {
    const ratio = Math.round((e.activeMonths / e.totalMonths) * 100);
    if (ratio >= 50) {
      defense.push({
        headline: `Activa en ${ratio}% de los meses de su vida`,
        detail: `Registra actividad en ${e.activeMonths} de ${e.totalMonths} meses. No es una wallet que despierta sólo para pedir crédito.`,
        dimension: "activeMonths",
      });
    } else {
      challenges.push({
        headline: "Actividad intermitente",
        detail: `Sólo ${e.activeMonths} de ${e.totalMonths} meses registran transacciones, un ${ratio}%. El uso es esporádico.`,
        dimension: "activeMonths",
      });
    }
  }

  if (e.distinctProtocols >= 4) {
    defense.push({
      headline: `Operó con ${e.distinctProtocols} contratos distintos`,
      detail: "La variedad de protocolos sugiere uso real del ecosistema y no una wallet de un solo propósito.",
      dimension: "distinctProtocols",
    });
  }

  for (const dimension of collected.truncated) {
    challenges.push({
      headline: "Conteo incompleto",
      detail: `El total de ${DIMENSION_LABELS[dimension]} supera el límite de la fuente consultada, así que la cifra es un piso y no un valor exacto.`,
      dimension,
    });
  }

  return { defense, challenges };
}

/**
 * Arma el expediente de la apelación con los dos agentes.
 *
 * Si el modelo no está disponible, devuelve los argumentos deterministas y lo
 * declara en `source`, para que la interfaz pueda decirlo en pantalla en vez de
 * presentar como análisis de un agente algo que no lo es.
 */
export async function buildCaseFile(collected: CollectedEvidence, apiKey: string | undefined): Promise<CaseFile> {
  const fallback = deterministicCase(collected);

  if (!apiKey) {
    return {
      ...fallback,
      source: "deterministic",
      fallbackReason: "Los agentes no están configurados en esta instancia",
    };
  }

  const truncatedNote = collected.truncated.length
    ? `\n\nAviso: el conteo de ${collected.truncated
        .map(d => DIMENSION_LABELS[d])
        .join(", ")} esta truncado por limites de la fuente, es un piso y no un valor exacto.`
    : "";

  const context = buildContext(collected, truncatedNote);
  const client = new Anthropic({ apiKey });

  try {
    // Los dos agentes corren en paralelo porque no se leen entre sí: la
    // contraparte cuestiona la evidencia, no el texto del defensor. Si leyera su
    // argumento tendería a responderle en vez de auditar los datos.
    const [defense, challenges] = await Promise.all([
      runAgent(client, DEFENDER_ROLE, context, collected),
      runAgent(client, COUNTERPARTY_ROLE, context, collected),
    ]);

    if (defense.length === 0 && challenges.length === 0) {
      return {
        ...fallback,
        source: "deterministic",
        fallbackReason: "Los agentes no devolvieron argumentos utilizables",
      };
    }

    return { defense, challenges, source: "model" };
  } catch (error) {
    return {
      ...fallback,
      source: "deterministic",
      // El mensaje del proveedor puede traer códigos, nombres de modelo o
      // fragmentos de la petición. Se cierra a un motivo legible.
      fallbackReason: "Los agentes no estuvieron disponibles",
    };
  }
}
