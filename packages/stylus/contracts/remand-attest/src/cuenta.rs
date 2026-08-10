//! Decodificacion de una cuenta del trie de estado.
//!
//! El valor que guarda el trie para una direccion es una lista RLP de cuatro
//! campos, en este orden: nonce, saldo, raiz de su almacenamiento y hash de su
//! codigo. El nonce es el que interesa aqui, porque es el numero de
//! transacciones que esa direccion ha firmado, y es exactamente el dato que
//! ningun opcode del EVM sabe leer de una cuenta ajena.

use crate::rlp::{self, RlpError};

pub struct Cuenta {
    pub nonce: u64,
    pub saldo: [u8; 32],
    pub raiz_almacenamiento: [u8; 32],
    pub hash_codigo: [u8; 32],
}

pub fn decodificar(valor: &[u8]) -> Result<Cuenta, RlpError> {
    Ok(Cuenta {
        nonce: entero_u64(rlp::campo(valor, 0)?)?,
        saldo: rellenar(rlp::campo(valor, 1)?)?,
        raiz_almacenamiento: exacto(rlp::campo(valor, 2)?)?,
        hash_codigo: exacto(rlp::campo(valor, 3)?)?,
    })
}

fn entero_u64(bytes: &[u8]) -> Result<u64, RlpError> {
    if bytes.len() > 8 {
        return Err(RlpError::LongitudNoCanonica);
    }
    // Los enteros en RLP no llevan ceros a la izquierda, y el cero es vacio.
    if bytes.first() == Some(&0) {
        return Err(RlpError::LongitudNoCanonica);
    }
    let mut n = 0u64;
    for b in bytes {
        n = (n << 8) | (*b as u64);
    }
    Ok(n)
}

/// El saldo es un entero de hasta 32 bytes, sin ceros a la izquierda, asi que
/// hay que alinearlo a la derecha para leerlo como U256.
fn rellenar(bytes: &[u8]) -> Result<[u8; 32], RlpError> {
    if bytes.len() > 32 {
        return Err(RlpError::LongitudNoCanonica);
    }
    if bytes.first() == Some(&0) {
        return Err(RlpError::LongitudNoCanonica);
    }
    let mut salida = [0u8; 32];
    salida[32 - bytes.len()..].copy_from_slice(bytes);
    Ok(salida)
}

fn exacto(bytes: &[u8]) -> Result<[u8; 32], RlpError> {
    if bytes.len() != 32 {
        return Err(RlpError::TipoInesperado);
    }
    let mut salida = [0u8; 32];
    salida.copy_from_slice(bytes);
    Ok(salida)
}
