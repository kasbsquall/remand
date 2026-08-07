//! Motor determinista de recálculo del veredicto.
//!
//! Todo el cálculo es aritmética entera sobre puntos base (bps), donde
//! 10_000 bps equivalen al 100%. No se usa punto flotante en ninguna parte:
//! el redondeo del flotante depende del orden de las operaciones y de la
//! plataforma, y eso rompería la promesa central de Remand, que cualquiera
//! pueda reproducir el fallo y obtener exactamente el mismo número.
//!
//! El motor es una función pura de la evidencia. No lee estado del contrato,
//! no consulta la hora, no depende de quién lo llama. Misma evidencia, mismo
//! veredicto, siempre.

use crate::evidence_schema::{Evidence, EvidenceError};

/// Escala del sistema: 10_000 bps = 100%.
pub const BPS: u32 = 10_000;

// --- Pesos de cada dimensión, en bps. Deben sumar exactamente BPS. ---

/// Historial de repago. Es la señal más directa de que la wallet devuelve lo
/// que toma prestado, y por eso lleva el mayor peso.
pub const W_REPAYMENT: u32 = 3_000;
/// Consistencia de actividad. Castiga a la wallet dormida que sólo despierta
/// para pedir el préstamo.
pub const W_CONSISTENCY: u32 = 2_500;
/// Antigüedad de la wallet.
pub const W_AGE: u32 = 2_000;
/// Ausencia de liquidaciones.
pub const W_LIQUIDATION: u32 = 1_500;
/// Diversidad de protocolos. Señal débil de sofisticación, peso menor.
pub const W_DIVERSITY: u32 = 1_000;

// --- Umbrales de saturación ---

/// Antigüedad a partir de la cual la dimensión puntúa al máximo: dos años.
pub const AGE_SATURATION_DAYS: u32 = 730;
/// Protocolos distintos a partir de los cuales la diversidad puntúa al máximo.
pub const DIVERSITY_SATURATION: u32 = 8;
/// Liquidaciones que llevan la dimensión a cero.
pub const LIQUIDATION_ZERO_AT: u32 = 3;

/// Puntaje total mínimo para que la apelación prospere.
pub const APPROVAL_THRESHOLD: u32 = 6_000;

/// Colateral exigido por la primera instancia cuando no pondera comportamiento.
pub const COLLATERAL_BASE_BPS: u32 = 12_000;
/// Colateral mínimo al que puede llegar una apelación con puntaje perfecto.
pub const COLLATERAL_FLOOR_BPS: u32 = 6_000;

/// Desglose del fallo. Se publica completo para que un tercero pueda rehacer
/// la suma sin volver a ejecutar el contrato.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Verdict {
    /// Puntaje de cada dimensión, en bps, antes de aplicar su peso.
    pub score_repayment: u32,
    pub score_consistency: u32,
    pub score_age: u32,
    pub score_liquidation: u32,
    pub score_diversity: u32,
    /// Suma ponderada de las cinco dimensiones, en bps.
    pub total_score: u32,
    /// Si el puntaje alcanza el umbral de aprobación.
    pub approved: bool,
    /// Colateral exigido tras el recálculo, en bps sobre el monto pedido.
    pub collateral_required_bps: u32,
}

/// Regla de tres entera con saturación, sin desbordar en u32.
///
/// Devuelve `value / ceiling` expresado en bps, topado en BPS. Se calcula en
/// u64 porque el producto por BPS desborda u32 con facilidad.
fn ratio_bps(value: u32, ceiling: u32) -> u32 {
    if ceiling == 0 {
        return 0;
    }
    let capped = if value > ceiling { ceiling } else { value };
    ((capped as u64 * BPS as u64) / ceiling as u64) as u32
}

/// Historial de repago: proporción de préstamos devueltos.
///
/// Una wallet sin préstamos puntúa cero, no porque sea mala pagadora, sino
/// porque no aporta evidencia en esta dimensión. Regalarle el máximo premiaría
/// la ausencia de historial, que es justo lo contrario de lo que mide.
pub fn score_repayment(e: &Evidence) -> u32 {
    ratio_bps(e.repayments, e.borrows)
}

/// Consistencia: meses activos sobre meses de vida de la wallet.
pub fn score_consistency(e: &Evidence) -> u32 {
    ratio_bps(e.active_months, e.total_months)
}

/// Antigüedad, saturando a los dos años.
pub fn score_age(e: &Evidence) -> u32 {
    ratio_bps(e.wallet_age_days, AGE_SATURATION_DAYS)
}

/// Ausencia de liquidaciones. Cae de forma lineal hasta cero.
///
/// Una wallet que nunca pidio prestado tampoco pudo ser liquidada, asi que no
/// puntua aqui. Darle el maximo convertiria la falta de historial en merito, y
/// una billetera creada ayer terminaria puntuando igual que una que sostuvo
/// posiciones durante dos anos sin caerse.
pub fn score_liquidation(e: &Evidence) -> u32 {
    if e.borrows == 0 {
        return 0;
    }
    if e.liquidations >= LIQUIDATION_ZERO_AT {
        return 0;
    }
    BPS - (e.liquidations * (BPS / LIQUIDATION_ZERO_AT))
}

/// Diversidad de protocolos, saturando a ocho.
pub fn score_diversity(e: &Evidence) -> u32 {
    ratio_bps(e.distinct_protocols, DIVERSITY_SATURATION)
}

/// Colateral exigido según el puntaje: interpola entre el 120% de la primera
/// instancia y el 60% que obtiene un expediente impecable.
fn collateral_for(total_score: u32) -> u32 {
    let span = COLLATERAL_BASE_BPS - COLLATERAL_FLOOR_BPS;
    let discount = ((total_score as u64 * span as u64) / BPS as u64) as u32;
    COLLATERAL_BASE_BPS - discount
}

/// Recalcula el veredicto a partir de la evidencia presentada.
///
/// Es el corazón del proyecto. Se ejecuta dentro del contrato Stylus y es
/// exactamente la misma función que expone la vista pública de verificación,
/// de modo que reproducir un fallo no exige confiar en Remand.
pub fn compute_verdict(e: &Evidence) -> Result<Verdict, EvidenceError> {
    e.validate()?;

    let score_repayment = score_repayment(e);
    let score_consistency = score_consistency(e);
    let score_age = score_age(e);
    let score_liquidation = score_liquidation(e);
    let score_diversity = score_diversity(e);

    // La suma se hace en u64 porque cinco productos de hasta 10_000 por 3_000
    // exceden el rango de u32 antes de dividir.
    let weighted = score_repayment as u64 * W_REPAYMENT as u64
        + score_consistency as u64 * W_CONSISTENCY as u64
        + score_age as u64 * W_AGE as u64
        + score_liquidation as u64 * W_LIQUIDATION as u64
        + score_diversity as u64 * W_DIVERSITY as u64;

    let total_score = (weighted / BPS as u64) as u32;

    Ok(Verdict {
        score_repayment,
        score_consistency,
        score_age,
        score_liquidation,
        score_diversity,
        total_score,
        approved: total_score >= APPROVAL_THRESHOLD,
        collateral_required_bps: collateral_for(total_score),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Expediente impecable: dos años de antigüedad, actividad continua,
    /// todo repagado, sin liquidaciones y amplia diversidad.
    fn expediente_impecable() -> Evidence {
        Evidence {
            wallet_age_days: 730,
            active_months: 24,
            total_months: 24,
            repayments: 12,
            borrows: 12,
            liquidations: 0,
            distinct_protocols: 8,
        }
    }

    #[test]
    fn los_pesos_suman_exactamente_cien_por_ciento() {
        assert_eq!(
            W_REPAYMENT + W_CONSISTENCY + W_AGE + W_LIQUIDATION + W_DIVERSITY,
            BPS
        );
    }

    #[test]
    fn expediente_impecable_puntua_al_maximo_y_aprueba() {
        let v = compute_verdict(&expediente_impecable()).unwrap();
        assert_eq!(v.total_score, BPS);
        assert!(v.approved);
        assert_eq!(v.collateral_required_bps, COLLATERAL_FLOOR_BPS);
    }

    #[test]
    fn wallet_vacia_puntua_cero_y_conserva_el_colateral_base() {
        let v = compute_verdict(&Evidence::default()).unwrap();
        assert_eq!(v.total_score, 0);
        assert!(!v.approved);
        assert_eq!(v.collateral_required_bps, COLLATERAL_BASE_BPS);
    }

    #[test]
    fn el_motor_es_determinista() {
        let e = expediente_impecable();
        let primera = compute_verdict(&e).unwrap();
        for _ in 0..100 {
            assert_eq!(compute_verdict(&e).unwrap(), primera);
        }
    }

    #[test]
    fn sin_prestamos_se_pierden_las_dos_dimensiones_de_credito() {
        // Una wallet impecable en todo lo demas, pero que nunca pidio prestado,
        // no aporta evidencia crediticia: ni repago ni resistencia a la
        // liquidacion. Ambas dimensiones quedan en cero.
        let e = Evidence {
            borrows: 0,
            repayments: 0,
            liquidations: 0,
            ..expediente_impecable()
        };
        let v = compute_verdict(&e).unwrap();
        assert_eq!(v.score_repayment, 0);
        assert_eq!(v.score_liquidation, 0);
        assert_eq!(v.total_score, BPS - W_REPAYMENT - W_LIQUIDATION);
        // 5_500 bps sigue por debajo del umbral: sin historial no hay apelacion
        // que prospere, y ese es el resultado correcto.
        assert!(!v.approved);
    }

    #[test]
    fn tres_liquidaciones_anulan_esa_dimension() {
        let e = Evidence {
            liquidations: 3,
            ..expediente_impecable()
        };
        assert_eq!(score_liquidation(&e), 0);
        let v = compute_verdict(&e).unwrap();
        assert_eq!(v.total_score, BPS - W_LIQUIDATION);
    }

    #[test]
    fn una_liquidacion_descuenta_un_tercio_de_su_dimension() {
        let e = Evidence {
            liquidations: 1,
            ..expediente_impecable()
        };
        assert_eq!(score_liquidation(&e), BPS - BPS / 3);
    }

    #[test]
    fn sin_prestamos_no_se_premia_la_ausencia_de_liquidaciones() {
        // Una wallet recien creada no puede haber sido liquidada. Si esta
        // dimension le diera el maximo, la falta de historial se leeria como
        // buen comportamiento.
        let recien_creada = Evidence::default();
        assert_eq!(score_liquidation(&recien_creada), 0);

        let con_historial = Evidence {
            borrows: 5,
            repayments: 5,
            liquidations: 0,
            ..Evidence::default()
        };
        assert_eq!(score_liquidation(&con_historial), BPS);
    }

    #[test]
    fn la_antiguedad_satura_a_los_dos_anos() {
        let joven = Evidence {
            wallet_age_days: 730,
            ..Evidence::default()
        };
        let veterana = Evidence {
            wallet_age_days: 3_650,
            total_months: 121,
            ..Evidence::default()
        };
        assert_eq!(score_age(&joven), BPS);
        assert_eq!(score_age(&veterana), BPS);
    }

    #[test]
    fn el_puntaje_nunca_excede_la_escala() {
        let desbordado = Evidence {
            wallet_age_days: u32::MAX,
            active_months: 1_000,
            total_months: 1_000,
            repayments: 500,
            borrows: 500,
            liquidations: 0,
            distinct_protocols: u32::MAX,
        };
        let v = compute_verdict(&desbordado).unwrap();
        assert_eq!(v.total_score, BPS);
    }

    #[test]
    fn la_evidencia_incoherente_se_rechaza() {
        let mas_repagos_que_prestamos = Evidence {
            repayments: 20,
            borrows: 5,
            ..expediente_impecable()
        };
        assert_eq!(
            compute_verdict(&mas_repagos_que_prestamos),
            Err(EvidenceError::RepaymentsExceedBorrows)
        );

        let mas_meses_activos_que_vividos = Evidence {
            active_months: 50,
            total_months: 24,
            ..expediente_impecable()
        };
        assert_eq!(
            compute_verdict(&mas_meses_activos_que_vividos),
            Err(EvidenceError::ActiveMonthsExceedTotal)
        );

        let meses_que_no_caben_en_los_dias = Evidence {
            wallet_age_days: 30,
            active_months: 24,
            total_months: 24,
            ..expediente_impecable()
        };
        assert_eq!(
            compute_verdict(&meses_que_no_caben_en_los_dias),
            Err(EvidenceError::AgeInconsistent)
        );
    }

    #[test]
    fn el_umbral_separa_aprobado_de_rechazado() {
        // Wallet real de perfil medio: un año, activa la mitad de los meses,
        // repagó todo lo que pidió, sin liquidaciones, poca diversidad.
        let media = Evidence {
            wallet_age_days: 365,
            active_months: 6,
            total_months: 12,
            repayments: 4,
            borrows: 4,
            liquidations: 0,
            distinct_protocols: 2,
        };
        let v = compute_verdict(&media).unwrap();
        // 3000 + 1250 + 1000 + 1500 + 250 = 7000
        assert_eq!(v.total_score, 7_000);
        assert!(v.approved);
        // El colateral baja del 120% al 78%.
        assert_eq!(v.collateral_required_bps, 7_800);
    }

    #[test]
    fn el_colateral_baja_de_forma_monotona_con_el_puntaje() {
        let mut anterior = COLLATERAL_BASE_BPS + 1;
        for score in (0..=BPS).step_by(250) {
            let actual = collateral_for(score);
            assert!(actual < anterior, "el colateral debe decrecer");
            assert!(actual >= COLLATERAL_FLOOR_BPS);
            anterior = actual;
        }
    }
}
