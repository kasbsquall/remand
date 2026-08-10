//! Recorrido de un trie de Merkle-Patricia con verificacion en cada salto.
//!
//! Como funciona una prueba. El trie guarda cada valor bajo una clave, y la
//! clave se recorre nibble a nibble (medio byte). Cada nodo del camino apunta al
//! siguiente por su hash. Una prueba es la lista de nodos desde la raiz hasta el
//! valor, y verificarla consiste en comprobar, en cada paso, que el keccak del
//! nodo que te dan es exactamente el hash que el nodo anterior esperaba.
//!
//! Por eso quien entrega la prueba no necesita ser de confianza: si cambia un
//! byte de cualquier nodo, su hash deja de cuadrar y el recorrido se detiene.
//!
//! Hay tres tipos de nodo:
//!
//! - Rama: lista de 17 elementos. Los 16 primeros son los hijos, uno por nibble
//!   posible, y el ultimo es el valor si la clave termina justo ahi.
//! - Extension: lista de 2. Comprime un tramo de camino que no se bifurca.
//! - Hoja: lista de 2. Contiene el final del camino y el valor.
//!
//! Extension y hoja se distinguen por el primer nibble del camino codificado,
//! que ademas dice si el numero de nibbles es par o impar. Esa codificacion se
//! llama hex-prefix y es la fuente habitual de errores off-by-one.

use crate::rlp::{self, RlpError};
use alloc::vec::Vec;
use stylus_sdk::crypto::keccak;

#[derive(Debug, PartialEq, Eq)]
pub enum TrieError {
    /// El keccak del nodo no es el que esperaba su padre. Prueba manipulada.
    HashNoCuadra,
    /// El nodo no se pudo leer como RLP.
    NodoIlegible,
    /// El camino de la clave se desvia del que describe la prueba.
    CaminoDivergente,
    /// La prueba se acabo antes de llegar al valor.
    PruebaIncompleta,
    /// Nodo con un numero de elementos que no es 2 ni 17.
    NodoDesconocido,
    /// Nodo embebido: mide menos de 32 bytes y va inline en vez de por hash.
    /// Es legal en el trie y poco frecuente en cuentas; se rechaza de forma
    /// explicita en vez de tratarlo mal en silencio.
    NodoEmbebido,
}

/// Convierte una clave de 32 bytes en sus 64 nibbles.
fn a_nibbles(clave: &[u8; 32]) -> [u8; 64] {
    let mut n = [0u8; 64];
    for (i, b) in clave.iter().enumerate() {
        n[i * 2] = b >> 4;
        n[i * 2 + 1] = b & 0x0f;
    }
    n
}

/// Decodifica el camino hex-prefix de un nodo de extension o de hoja.
///
/// El primer nibble codifica dos cosas a la vez: si el nodo es hoja (bit 1) y si
/// el numero de nibbles del camino es impar (bit 0). Cuando es impar, el segundo
/// nibble del primer byte ya forma parte del camino.
fn camino_codificado(bytes: &[u8]) -> Result<(Vec<u8>, bool), TrieError> {
    let primero = *bytes.first().ok_or(TrieError::NodoIlegible)?;
    let bandera = primero >> 4;
    let es_hoja = bandera & 0x02 != 0;
    let impar = bandera & 0x01 != 0;

    let mut camino = Vec::with_capacity(bytes.len() * 2);
    if impar {
        camino.push(primero & 0x0f);
    } else if primero & 0x0f != 0 {
        // En la forma par, el segundo nibble tiene que ser cero. Si no lo es, la
        // codificacion no es canonica.
        return Err(TrieError::NodoIlegible);
    }
    for b in &bytes[1..] {
        camino.push(b >> 4);
        camino.push(b & 0x0f);
    }
    Ok((camino, es_hoja))
}

/// Recorre el trie desde `raiz` siguiendo `clave`, verificando cada nodo.
///
/// Devuelve el valor almacenado, o un error si la prueba no sostiene el camino.
/// No devuelve nada "por defecto": o la prueba demuestra el valor, o falla.
pub fn buscar(raiz: [u8; 32], clave: &[u8; 32], prueba: &[Vec<u8>]) -> Result<Vec<u8>, TrieError> {
    let nibbles = a_nibbles(clave);
    let mut esperado = raiz;
    let mut pos = 0usize;

    for nodo in prueba {
        // El paso que hace que la prueba sea una prueba.
        if keccak(nodo).as_slice() != esperado.as_slice() {
            return Err(TrieError::HashNoCuadra);
        }

        let cuantos = rlp::cuantos(nodo).map_err(|_| TrieError::NodoIlegible)?;

        match cuantos {
            17 => {
                // Rama. Si la clave se acabo, el valor esta en el ultimo hueco.
                if pos >= 64 {
                    let v = rlp::campo(nodo, 16).map_err(|_| TrieError::NodoIlegible)?;
                    return Ok(v.to_vec());
                }
                let hijo = rlp::campo(nodo, nibbles[pos] as usize)
                    .map_err(|_| TrieError::NodoIlegible)?;
                pos += 1;
                esperado = siguiente_hash(hijo)?;
            }
            2 => {
                let bruto = rlp::campo(nodo, 0).map_err(|_| TrieError::NodoIlegible)?;
                let (camino, es_hoja) = camino_codificado(bruto)?;

                // El tramo del nodo tiene que coincidir con lo que queda de la
                // clave. Si no, la prueba describe otro camino.
                if pos + camino.len() > 64 {
                    return Err(TrieError::CaminoDivergente);
                }
                if nibbles[pos..pos + camino.len()] != camino[..] {
                    return Err(TrieError::CaminoDivergente);
                }
                pos += camino.len();

                let segundo = rlp::campo(nodo, 1).map_err(|_| TrieError::NodoIlegible)?;
                if es_hoja {
                    // Una hoja solo vale si consumio la clave entera.
                    if pos != 64 {
                        return Err(TrieError::CaminoDivergente);
                    }
                    return Ok(segundo.to_vec());
                }
                esperado = siguiente_hash(segundo)?;
            }
            _ => return Err(TrieError::NodoDesconocido),
        }
    }

    Err(TrieError::PruebaIncompleta)
}

/// Lee la referencia al siguiente nodo, que siempre es un hash de 32 bytes.
///
/// Un nodo de menos de 32 bytes va embebido en su padre en vez de referenciado.
/// Es legal y aqui se rechaza a proposito: tratarlo mal en silencio produciria
/// una verificacion que parece correcta y no lo es.
fn siguiente_hash(referencia: &[u8]) -> Result<[u8; 32], TrieError> {
    if referencia.len() != 32 {
        return Err(TrieError::NodoEmbebido);
    }
    let mut h = [0u8; 32];
    h.copy_from_slice(referencia);
    Ok(h)
}
