//! Lector de RLP, lo justo para recorrer una cabecera de bloque.
//!
//! Se escribe a mano en vez de traer un crate por dos razones. La primera es de
//! versiones: alinear `alloy-rlp` con la version de `alloy-primitives` que
//! arrastra el SDK cuesta mas tiempo del que ahorra. La segunda es de tamano:
//! un contrato Stylus tiene 24 KB comprimidos y el motor del fallo ya ocupa
//! 12,2, asi que cada dependencia se paga.
//!
//! No decodifica RLP entero. Solo hace falta recorrer una lista de cadenas de
//! bytes por posicion, que es exactamente lo que es una cabecera.

/// Error al recorrer una estructura RLP. Cualquiera de estos significa que lo
/// que llego no es una cabecera de bloque valida.
#[derive(Debug, PartialEq, Eq)]
pub enum RlpError {
    /// Se acabaron los bytes en mitad de un campo.
    Truncado,
    /// Se esperaba una lista y llego una cadena, o al reves.
    TipoInesperado,
    /// Longitud codificada con ceros a la izquierda, o mas corta de lo debido.
    LongitudNoCanonica,
    /// El campo pedido no existe en la lista.
    FueraDeRango,
}

/// Cabecera de un elemento RLP: donde empieza su contenido y cuanto mide.
struct Marca {
    inicio: usize,
    largo: usize,
    es_lista: bool,
    /// Bytes que ocupa la cabecera del propio elemento.
    prefijo: usize,
}

fn leer_marca(datos: &[u8], pos: usize) -> Result<Marca, RlpError> {
    let primero = *datos.get(pos).ok_or(RlpError::Truncado)? as usize;

    // Un byte suelto por debajo de 0x80 se representa a si mismo.
    if primero < 0x80 {
        return Ok(Marca { inicio: pos, largo: 1, es_lista: false, prefijo: 0 });
    }

    // Cadena corta, hasta 55 bytes.
    if primero < 0xb8 {
        let largo = primero - 0x80;
        // Una cadena de un byte por debajo de 0x80 tendria que ir sin prefijo.
        if largo == 1 {
            let b = *datos.get(pos + 1).ok_or(RlpError::Truncado)?;
            if b < 0x80 {
                return Err(RlpError::LongitudNoCanonica);
            }
        }
        return Ok(Marca { inicio: pos + 1, largo, es_lista: false, prefijo: 1 });
    }

    // Cadena larga: el prefijo dice cuantos bytes ocupa la longitud.
    if primero < 0xc0 {
        let bytes_largo = primero - 0xb7;
        let largo = leer_largo(datos, pos + 1, bytes_largo)?;
        return Ok(Marca {
            inicio: pos + 1 + bytes_largo,
            largo,
            es_lista: false,
            prefijo: 1 + bytes_largo,
        });
    }

    // Lista corta.
    if primero < 0xf8 {
        let largo = primero - 0xc0;
        return Ok(Marca { inicio: pos + 1, largo, es_lista: true, prefijo: 1 });
    }

    // Lista larga.
    let bytes_largo = primero - 0xf7;
    let largo = leer_largo(datos, pos + 1, bytes_largo)?;
    Ok(Marca {
        inicio: pos + 1 + bytes_largo,
        largo,
        es_lista: true,
        prefijo: 1 + bytes_largo,
    })
}

fn leer_largo(datos: &[u8], pos: usize, n: usize) -> Result<usize, RlpError> {
    if n == 0 || n > 8 {
        return Err(RlpError::LongitudNoCanonica);
    }
    let trozo = datos.get(pos..pos + n).ok_or(RlpError::Truncado)?;
    // Un cero a la izquierda significa que la longitud podria haberse escrito
    // mas corta. RLP canonico lo prohibe, y aceptarlo abriria dos codificaciones
    // distintas para la misma cabecera, o sea dos hashes.
    if trozo[0] == 0 {
        return Err(RlpError::LongitudNoCanonica);
    }
    let mut largo = 0usize;
    for b in trozo {
        largo = (largo << 8) | (*b as usize);
    }
    // Por debajo de 56 tendria que haberse usado la forma corta.
    if largo < 56 {
        return Err(RlpError::LongitudNoCanonica);
    }
    Ok(largo)
}

/// Devuelve el contenido del campo `indice` de una lista RLP.
///
/// La cabecera de un bloque es una lista de cadenas de bytes, y cada dato se
/// identifica por su posicion: 3 es el stateRoot, 5 el receiptsRoot, 8 el
/// numero de bloque.
pub fn campo(lista: &[u8], indice: usize) -> Result<&[u8], RlpError> {
    let marca = leer_marca(lista, 0)?;
    if !marca.es_lista {
        return Err(RlpError::TipoInesperado);
    }
    let fin = marca
        .inicio
        .checked_add(marca.largo)
        .ok_or(RlpError::Truncado)?;
    if fin > lista.len() {
        return Err(RlpError::Truncado);
    }

    let mut pos = marca.inicio;
    let mut i = 0usize;
    while pos < fin {
        let m = leer_marca(lista, pos)?;
        let contenido_fin = m.inicio.checked_add(m.largo).ok_or(RlpError::Truncado)?;
        if contenido_fin > fin {
            return Err(RlpError::Truncado);
        }
        if i == indice {
            return lista.get(m.inicio..contenido_fin).ok_or(RlpError::Truncado);
        }
        // Un byte suelto no tiene prefijo, asi que su contenido ya lo incluye.
        pos = if m.prefijo == 0 { m.inicio + 1 } else { contenido_fin };
        i += 1;
    }
    Err(RlpError::FueraDeRango)
}

/// Cuantos elementos tiene una lista RLP. Sirve para saber con que fork se
/// construyo la cabecera: Nitro anade campos al final segun la version.
pub fn cuantos(lista: &[u8]) -> Result<usize, RlpError> {
    let marca = leer_marca(lista, 0)?;
    if !marca.es_lista {
        return Err(RlpError::TipoInesperado);
    }
    let fin = marca.inicio + marca.largo;
    if fin > lista.len() {
        return Err(RlpError::Truncado);
    }
    let mut pos = marca.inicio;
    let mut n = 0usize;
    while pos < fin {
        let m = leer_marca(lista, pos)?;
        pos = if m.prefijo == 0 { m.inicio + 1 } else { m.inicio + m.largo };
        n += 1;
    }
    Ok(n)
}

/// Contenido de un elemento RLP suelto, no de una lista.
///
/// El valor de una posicion de almacenamiento va envuelto asi, y confundirlo con
/// una lista devolveria basura en vez de fallar.
pub fn campo_suelto(datos: &[u8]) -> Result<&[u8], RlpError> {
    let m = leer_marca(datos, 0)?;
    if m.es_lista {
        return Err(RlpError::TipoInesperado);
    }
    let fin = m.inicio.checked_add(m.largo).ok_or(RlpError::Truncado)?;
    datos.get(m.inicio..fin).ok_or(RlpError::Truncado)
}
