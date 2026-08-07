//! Esquema de evidencia que acepta el motor de veredicto de Remand.
//!
//! Cada campo es una magnitud que se puede leer del historial real de una
//! wallet en Arbitrum vía RPC. No hay campos que dependan de un oráculo, de
//! una fuente privada ni del criterio de los agentes de IA: si un dato no se
//! puede derivar de la cadena, no entra aquí.
//!
//! Todos los enteros son sin signo y de ancho fijo para que la codificación
//! ABI y el cálculo sean idénticos dentro y fuera de la cadena.

/// Evidencia de comportamiento on-chain presentada en una apelación.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Evidence {
    /// Días transcurridos desde la primera transacción de la wallet.
    pub wallet_age_days: u32,
    /// Meses en los que la wallet registró al menos una transacción.
    pub active_months: u32,
    /// Meses transcurridos desde la primera transacción.
    pub total_months: u32,
    /// Eventos de repago registrados en protocolos de préstamo.
    pub repayments: u32,
    /// Eventos de préstamo tomados en protocolos de préstamo.
    pub borrows: u32,
    /// Liquidaciones sufridas por la wallet.
    pub liquidations: u32,
    /// Contratos distintos con los que la wallet interactuó.
    pub distinct_protocols: u32,
}

/// Motivos por los que una evidencia se rechaza antes de puntuar.
///
/// Rechazar es preferible a corregir en silencio: un dato incoherente
/// significa que el recolector falló, y un fallo emitido sobre datos rotos
/// no sería reproducible por un tercero.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EvidenceError {
    /// `active_months` no puede superar a `total_months`.
    ActiveMonthsExceedTotal,
    /// `repayments` no puede superar a `borrows`.
    RepaymentsExceedBorrows,
    /// La antigüedad en días y en meses se contradicen.
    AgeInconsistent,
}

/// Días que el motor considera equivalentes a un mes.
///
/// Es una constante del protocolo, no un promedio calendario: fijarla evita
/// que el resultado dependa de en qué meses cayó la actividad.
pub const DAYS_PER_MONTH: u32 = 30;

impl Evidence {
    /// Verifica que la evidencia sea internamente coherente.
    pub fn validate(&self) -> Result<(), EvidenceError> {
        if self.active_months > self.total_months {
            return Err(EvidenceError::ActiveMonthsExceedTotal);
        }
        if self.repayments > self.borrows {
            return Err(EvidenceError::RepaymentsExceedBorrows);
        }
        // Los meses declarados no pueden exceder a los que caben en los días
        // declarados. Se admite un mes de holgura por el redondeo del mes fijo.
        if self.total_months > self.wallet_age_days / DAYS_PER_MONTH + 1 {
            return Err(EvidenceError::AgeInconsistent);
        }
        Ok(())
    }
}
