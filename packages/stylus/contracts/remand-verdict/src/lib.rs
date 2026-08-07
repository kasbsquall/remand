//! Remand · La segunda instancia del crédito on-chain.
//!
//! Cuando una solicitud de préstamo se rechaza en primera instancia, el
//! solicitante apela. Un agente reúne evidencia de su comportamiento real en
//! la cadena y un agente contraparte la cuestiona. Este contrato hace lo único
//! que no puede quedar en manos de un servidor privado: computar el fallo.
//!
//! La separación es deliberada. Los agentes preparan y discuten la evidencia;
//! el veredicto lo calcula este contrato, de forma determinista y con el
//! desglose completo escrito en la cadena. Por eso `preview_verdict` es una
//! vista pura: cualquiera puede pasarle la misma evidencia de un expediente y
//! obtener exactamente el mismo número que se registró, sin permiso, sin
//! costo y sin tener que confiar en Remand.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

use stylus_sdk::{
    alloy_primitives::{Address, U256, U32},
    alloy_sol_types::sol,
    prelude::*,
    stylus_core::log,
};

pub mod evidence_schema;
pub mod verdict_engine;

use evidence_schema::{Evidence, EvidenceError};
use verdict_engine::{
    compute_verdict, APPROVAL_THRESHOLD, W_AGE, W_CONSISTENCY, W_DIVERSITY, W_LIQUIDATION,
    W_REPAYMENT,
};

sol! {
    /// Se emite al registrarse la apelación, antes de computar el fallo.
    event AppealFiled(uint256 indexed caseId, address indexed appellant);

    /// El fallo completo. Publica cada dimensión por separado para que el
    /// desglose viva en la cadena y no sólo en la interfaz.
    event VerdictIssued(
        uint256 indexed caseId,
        address indexed appellant,
        uint32 scoreRepayment,
        uint32 scoreConsistency,
        uint32 scoreAge,
        uint32 scoreLiquidation,
        uint32 scoreDiversity,
        uint32 totalScore,
        bool approved,
        uint32 collateralRequiredBps
    );

    /// La evidencia presentada es internamente incoherente.
    error InconsistentEvidence(uint8 reason);
    /// Ese expediente ya tiene un fallo. Un caso se falla una sola vez.
    error CaseAlreadyJudged(uint256 caseId);
    /// Se consultó un expediente que nunca fue fallado.
    error CaseNotFound(uint256 caseId);
}

#[derive(SolidityError)]
pub enum Error {
    InconsistentEvidence(InconsistentEvidence),
    CaseAlreadyJudged(CaseAlreadyJudged),
    CaseNotFound(CaseNotFound),
}

impl From<EvidenceError> for Error {
    fn from(value: EvidenceError) -> Self {
        // El motivo se codifica como entero para que la interfaz pueda
        // traducirlo sin depender del texto del error.
        let reason = match value {
            EvidenceError::ActiveMonthsExceedTotal => 1,
            EvidenceError::RepaymentsExceedBorrows => 2,
            EvidenceError::AgeInconsistent => 3,
        };
        Error::InconsistentEvidence(InconsistentEvidence { reason })
    }
}

sol_storage! {
    #[entrypoint]
    pub struct RemandVerdict {
        /// Fallos emitidos, indexados por número de expediente.
        mapping(uint256 => Ruling) rulings;
        /// Cantidad de apelaciones falladas. Sirve de índice para la interfaz.
        uint256 total_appeals;
    }

    /// Fallo almacenado. Guarda el desglose completo, no sólo el resultado:
    /// un veredicto que no se puede auditar no vale más que un rechazo.
    pub struct Ruling {
        bool exists;
        address appellant;
        uint32 score_repayment;
        uint32 score_consistency;
        uint32 score_age;
        uint32 score_liquidation;
        uint32 score_diversity;
        uint32 total_score;
        bool approved;
        uint32 collateral_required_bps;
    }
}

#[public]
impl RemandVerdict {
    /// Presenta una apelación y falla el expediente en el mismo acto.
    ///
    /// Recibe la evidencia ya estructurada por el agente defensor y revisada
    /// por el agente contraparte. El contrato no confía en ese trabajo: valida
    /// la coherencia interna de los datos y rechaza el expediente si no cierra.
    #[allow(clippy::too_many_arguments)]
    pub fn submit_appeal(
        &mut self,
        case_id: U256,
        wallet_age_days: u32,
        active_months: u32,
        total_months: u32,
        repayments: u32,
        borrows: u32,
        liquidations: u32,
        distinct_protocols: u32,
    ) -> Result<(), Error> {
        if self.rulings.get(case_id).exists.get() {
            return Err(Error::CaseAlreadyJudged(CaseAlreadyJudged { caseId: case_id }));
        }

        let appellant = self.vm().msg_sender();
        log(self.vm(), AppealFiled { caseId: case_id, appellant });

        let evidence = Evidence {
            wallet_age_days,
            active_months,
            total_months,
            repayments,
            borrows,
            liquidations,
            distinct_protocols,
        };

        let verdict = compute_verdict(&evidence)?;

        let mut ruling = self.rulings.setter(case_id);
        ruling.exists.set(true);
        ruling.appellant.set(appellant);
        ruling.score_repayment.set(U32::from(verdict.score_repayment));
        ruling.score_consistency.set(U32::from(verdict.score_consistency));
        ruling.score_age.set(U32::from(verdict.score_age));
        ruling.score_liquidation.set(U32::from(verdict.score_liquidation));
        ruling.score_diversity.set(U32::from(verdict.score_diversity));
        ruling.total_score.set(U32::from(verdict.total_score));
        ruling.approved.set(verdict.approved);
        ruling
            .collateral_required_bps
            .set(U32::from(verdict.collateral_required_bps));

        let total = self.total_appeals.get();
        self.total_appeals.set(total + U256::from(1));

        log(
            self.vm(),
            VerdictIssued {
                caseId: case_id,
                appellant,
                scoreRepayment: verdict.score_repayment,
                scoreConsistency: verdict.score_consistency,
                scoreAge: verdict.score_age,
                scoreLiquidation: verdict.score_liquidation,
                scoreDiversity: verdict.score_diversity,
                totalScore: verdict.total_score,
                approved: verdict.approved,
                collateralRequiredBps: verdict.collateral_required_bps,
            },
        );

        Ok(())
    }

    /// Reproduce un fallo sin tocar el estado ni pagar gas.
    ///
    /// Esta es la función que sostiene la tesis del proyecto. Es exactamente
    /// el mismo motor que usa `submit_appeal`, expuesto como vista pura, así
    /// que cualquiera puede tomar la evidencia de un expediente ya fallado,
    /// pasarla por aquí y comprobar que el número coincide.
    #[allow(clippy::too_many_arguments)]
    pub fn preview_verdict(
        &self,
        wallet_age_days: u32,
        active_months: u32,
        total_months: u32,
        repayments: u32,
        borrows: u32,
        liquidations: u32,
        distinct_protocols: u32,
    ) -> Result<(u32, u32, u32, u32, u32, u32, bool, u32), Error> {
        let evidence = Evidence {
            wallet_age_days,
            active_months,
            total_months,
            repayments,
            borrows,
            liquidations,
            distinct_protocols,
        };
        let v = compute_verdict(&evidence)?;
        Ok((
            v.score_repayment,
            v.score_consistency,
            v.score_age,
            v.score_liquidation,
            v.score_diversity,
            v.total_score,
            v.approved,
            v.collateral_required_bps,
        ))
    }

    /// Devuelve el fallo registrado de un expediente.
    pub fn get_ruling(
        &self,
        case_id: U256,
    ) -> Result<(Address, u32, u32, u32, u32, u32, u32, bool, u32), Error> {
        let ruling = self.rulings.get(case_id);
        if !ruling.exists.get() {
            return Err(Error::CaseNotFound(CaseNotFound { caseId: case_id }));
        }
        Ok((
            ruling.appellant.get(),
            ruling.score_repayment.get().to::<u32>(),
            ruling.score_consistency.get().to::<u32>(),
            ruling.score_age.get().to::<u32>(),
            ruling.score_liquidation.get().to::<u32>(),
            ruling.score_diversity.get().to::<u32>(),
            ruling.total_score.get().to::<u32>(),
            ruling.approved.get(),
            ruling.collateral_required_bps.get().to::<u32>(),
        ))
    }

    /// Publica los pesos y el umbral que gobiernan el fallo.
    ///
    /// Las reglas que deciden un crédito tienen que ser legibles desde la
    /// propia interfaz, no sólo desde el código fuente. Sin esto, el desglose
    /// del fallo sería una lista de números sin referencia.
    pub fn weights(&self) -> (u32, u32, u32, u32, u32, u32) {
        (
            W_REPAYMENT,
            W_CONSISTENCY,
            W_AGE,
            W_LIQUIDATION,
            W_DIVERSITY,
            APPROVAL_THRESHOLD,
        )
    }

    /// Cantidad de apelaciones falladas hasta el momento.
    pub fn total_appeals(&self) -> U256 {
        self.total_appeals.get()
    }

    /// Indica si un expediente ya tiene fallo.
    pub fn is_judged(&self, case_id: U256) -> bool {
        self.rulings.get(case_id).exists.get()
    }
}
