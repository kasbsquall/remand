//! Lectura de los campos de una cabecera de bloque.
//!
//! El orden de los campos de una cabecera de Ethereum esta fijado por la
//! especificacion y Nitro lo respeta, anadiendo campos al final segun el fork.
//! Por eso NO se comprueba el numero de campos: se leen por indice los que
//! interesan, que estan todos en las primeras nueve posiciones y no se mueven.
//! Fijar el total romperia el contrato el dia que Arbitrum active un fork nuevo.

use crate::rlp::{self, RlpError};

/// Posiciones dentro de la lista, segun la especificacion.
const STATE_ROOT: usize = 3;
const RECEIPTS_ROOT: usize = 5;
const NUMERO: usize = 8;

/// Raiz del estado, el campo que permite verificar cuentas ajenas.
pub fn state_root(cabecera: &[u8]) -> Result<[u8; 32], RlpError> {
    treinta_y_dos(rlp::campo(cabecera, STATE_ROOT)?)
}

/// Raiz de los recibos, para verificar que un evento ocurrio.
pub fn receipts_root(cabecera: &[u8]) -> Result<[u8; 32], RlpError> {
    treinta_y_dos(rlp::campo(cabecera, RECEIPTS_ROOT)?)
}

/// Numero de bloque que declara la propia cabecera.
///
/// Comprobarlo importa: sin esto, alguien podria entregar la cabecera del
/// bloque N y pedir que se ancle como si fuera la del M. El hash coincidiria
/// con el de N y el contrato guardaria una raiz bajo el numero equivocado.
pub fn numero(cabecera: &[u8]) -> Result<u64, RlpError> {
    let bytes = rlp::campo(cabecera, NUMERO)?;
    if bytes.len() > 8 {
        return Err(RlpError::LongitudNoCanonica);
    }
    // Los enteros en RLP van sin ceros a la izquierda.
    if bytes.first() == Some(&0) {
        return Err(RlpError::LongitudNoCanonica);
    }
    let mut n = 0u64;
    for b in bytes {
        n = (n << 8) | (*b as u64);
    }
    Ok(n)
}

fn treinta_y_dos(bytes: &[u8]) -> Result<[u8; 32], RlpError> {
    if bytes.len() != 32 {
        return Err(RlpError::TipoInesperado);
    }
    let mut salida = [0u8; 32];
    salida.copy_from_slice(bytes);
    Ok(salida)
}
