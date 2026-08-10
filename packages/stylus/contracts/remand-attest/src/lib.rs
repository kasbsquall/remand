//! Ancla bloques de Arbitrum One dentro del contrato, sin oraculo.
//!
//! El problema que resuelve. Un contrato no puede leer el historial de una
//! wallet: no hay opcode que devuelva el nonce de una cuenta ajena, y los logs
//! pasados no son accesibles desde dentro de la cadena. Por eso todo sistema que
//! puntua direcciones acaba con alguien de fuera afirmando los datos, y hay que
//! creerle.
//!
//! Hay una salida, y es propia de Arbitrum. El precompilado ArbSys, en la
//! direccion 0x64, expone `arbBlockHash`, que devuelve el hash REAL de un bloque
//! L2 dentro de una ventana de 256 bloques. Ojo con no confundirlo con el opcode
//! BLOCKHASH del EVM, que en Nitro devuelve un valor pseudoaleatorio y no sirve
//! para anclar nada.
//!
//! Con eso, el procedimiento es: alguien entrega la cabecera del bloque
//! codificada en RLP, el contrato calcula su keccak y lo compara con lo que dice
//! la cadena. Si coincide, no hay nada que creer: esa cabecera es la de ese
//! bloque, y la raiz de estado que lleva dentro pasa a ser un hecho verificado.
//! A partir de ahi se pueden comprobar pruebas de Merkle-Patricia sobre
//! cualquier cuenta.
//!
//! Quien entrega la cabecera no tiene que ser de confianza. Si miente, el keccak
//! no cuadra y la transaccion revierte.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

pub mod cabecera;
pub mod cuenta;
pub mod rlp;
pub mod trie;

use alloc::vec::Vec;
use alloy_primitives::{Address, B256, U256};
use alloy_sol_types::sol;
use stylus_sdk::{
    abi::Bytes,
    call::static_call,
    crypto::keccak,
    prelude::*,
    storage::{StorageMap, StorageU256},
};

/// ArbSys. Existe en todas las cadenas de Arbitrum, incluidas las de pruebas.
const ARB_SYS: [u8; 20] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x64,
];

/// Selector de `arbBlockHash(uint256)`, los cuatro primeros bytes de su keccak.
const SELECTOR_BLOCK_HASH: [u8; 4] = [0x2b, 0x40, 0x7a, 0x82];

sol! {
    /// Una raiz de estado quedo anclada, y con ella todo lo que se pueda probar
    /// contra ella.
    event BloqueAnclado(uint64 indexed numero, bytes32 stateRoot, bytes32 receiptsRoot);

    /// La cabecera entregada no es la del bloque que dice ser.
    error CabeceraNoCoincide(uint64 numero, bytes32 esperado, bytes32 calculado);
    /// El bloque cayo fuera de la ventana de 256 que cubre el precompilado.
    error FueraDeVentana(uint64 numero);
    /// La cabecera no se pudo recorrer como RLP.
    error CabeceraIlegible();
    /// El numero que declara la cabecera no es el que se pidio anclar.
    error NumeroDiscrepante(uint64 pedido, uint64 declarado);
    /// La prueba no sostiene el camino hasta la cuenta.
    error PruebaInvalida(uint8 motivo);
    /// Se pidio verificar contra un bloque que nadie anclo.
    error BloqueSinAnclar(uint64 numero);
    /// El valor encontrado no es una cuenta bien formada.
    error CuentaIlegible();
}

#[derive(SolidityError)]
pub enum Error {
    CabeceraNoCoincide(CabeceraNoCoincide),
    FueraDeVentana(FueraDeVentana),
    CabeceraIlegible(CabeceraIlegible),
    NumeroDiscrepante(NumeroDiscrepante),
    PruebaInvalida(PruebaInvalida),
    BloqueSinAnclar(BloqueSinAnclar),
    CuentaIlegible(CuentaIlegible),
}

#[entrypoint]
#[storage]
pub struct RemandAttest {
    /// numero de bloque -> raiz de estado, una vez verificada.
    raices: StorageMap<U256, StorageU256>,
    /// numero de bloque -> raiz de recibos.
    recibos: StorageMap<U256, StorageU256>,
}

#[public]
impl RemandAttest {
    /// Ancla un bloque comprobando su cabecera contra la propia cadena.
    ///
    /// No hay parametro de confianza. Se entrega la cabecera cruda y el contrato
    /// decide si es autentica preguntandole al precompilado.
    pub fn anchor(&mut self, numero: u64, cabecera_rlp: Bytes) -> Result<B256, Error> {
        let datos = cabecera_rlp.as_slice();

        // Que la cabecera diga ser de otro bloque es un ataque, no un descuido:
        // permitiria guardar una raiz autentica bajo un numero que no le toca.
        let declarado =
            cabecera::numero(datos).map_err(|_| Error::CabeceraIlegible(CabeceraIlegible {}))?;
        if declarado != numero {
            return Err(Error::NumeroDiscrepante(NumeroDiscrepante {
                pedido: numero,
                declarado,
            }));
        }

        let esperado = self.hash_de_la_cadena(numero)?;
        let calculado = keccak(datos);
        if calculado.as_slice() != esperado.as_slice() {
            return Err(Error::CabeceraNoCoincide(CabeceraNoCoincide {
                numero,
                esperado,
                calculado: B256::from_slice(calculado.as_slice()),
            }));
        }

        let estado = cabecera::state_root(datos)
            .map_err(|_| Error::CabeceraIlegible(CabeceraIlegible {}))?;
        let recibos = cabecera::receipts_root(datos)
            .map_err(|_| Error::CabeceraIlegible(CabeceraIlegible {}))?;

        let clave = U256::from(numero);
        self.raices.setter(clave).set(U256::from_be_bytes(estado));
        self.recibos.setter(clave).set(U256::from_be_bytes(recibos));

        log(
            self.vm(),
            BloqueAnclado {
                numero,
                stateRoot: B256::from(estado),
                receiptsRoot: B256::from(recibos),
            },
        );

        Ok(B256::from(estado))
    }

    /// Raiz de estado ya anclada, o cero si ese bloque no se anclo.
    pub fn state_root(&self, numero: u64) -> B256 {
        B256::from(self.raices.get(U256::from(numero)).to_be_bytes())
    }

    /// Raiz de recibos ya anclada, o cero.
    pub fn receipts_root(&self, numero: u64) -> B256 {
        B256::from(self.recibos.get(U256::from(numero)).to_be_bytes())
    }

    /// Si un bloque esta anclado. Util para que la interfaz no ofrezca verificar
    /// contra una raiz que no existe.
    pub fn is_anchored(&self, numero: u64) -> bool {
        !self.raices.get(U256::from(numero)).is_zero()
    }

    /// Lee del RLP la raiz de estado sin anclar nada ni gastar gas.
    ///
    /// Sirve para que cualquiera compruebe desde su navegador que el contrato
    /// interpreta la cabecera igual que su propio nodo, antes de firmar nada.
    pub fn peek_state_root(&self, cabecera_rlp: Bytes) -> Result<B256, Error> {
        cabecera::state_root(cabecera_rlp.as_slice())
            .map(B256::from)
            .map_err(|_| Error::CabeceraIlegible(CabeceraIlegible {}))
    }


    /// Lee el nonce y el saldo de una direccion contra una raiz de estado, sin
    /// gastar gas y sin firmar nada.
    ///
    /// Esta es la funcion que sostiene el argumento. Ningun opcode del EVM
    /// devuelve el nonce de una cuenta ajena; con una raiz verificada y una
    /// prueba de Merkle-Patricia, el contrato lo demuestra. Cualquiera puede
    /// llamarla desde su navegador con una prueba que le sirva un nodo publico,
    /// y comparar el resultado con lo que muestra un explorador.
    ///
    /// La raiz se pasa como parametro para que se pueda comprobar sin haber
    /// anclado nada. La version que exige anclaje previo es `verify_account`.
    pub fn preview_account(
        &self,
        state_root: B256,
        cuenta: Address,
        prueba: Vec<Bytes>,
    ) -> Result<(u64, U256, B256, B256), Error> {
        let nodos: Vec<Vec<u8>> = prueba.into_iter().map(|b| b.to_vec()).collect();
        // El camino en el trie es el keccak de la direccion, no la direccion.
        let clave = keccak(cuenta.as_slice());
        let mut c = [0u8; 32];
        c.copy_from_slice(clave.as_slice());

        let valor = trie::buscar(state_root.0, &c, &nodos)
            .map_err(|e| Error::PruebaInvalida(PruebaInvalida { motivo: codigo(e) }))?;
        let datos = cuenta::decodificar(&valor)
            .map_err(|_| Error::CuentaIlegible(CuentaIlegible {}))?;

        Ok((
            datos.nonce,
            U256::from_be_bytes(datos.saldo),
            B256::from(datos.raiz_almacenamiento),
            B256::from(datos.hash_codigo),
        ))
    }

    /// Igual que la anterior, pero exigiendo que el bloque se haya anclado antes.
    ///
    /// La diferencia importa: aqui la raiz no la elige quien llama, sale de una
    /// cabecera que el contrato ya verifico contra la propia cadena. Es la
    /// version sin ningun punto de confianza.
    pub fn verify_account(
        &self,
        numero: u64,
        cuenta: Address,
        prueba: Vec<Bytes>,
    ) -> Result<(u64, U256, B256, B256), Error> {
        let raiz = self.raices.get(U256::from(numero));
        if raiz.is_zero() {
            return Err(Error::BloqueSinAnclar(BloqueSinAnclar { numero }));
        }
        self.preview_account(B256::from(raiz.to_be_bytes()), cuenta, prueba)
    }

    /// Lee una posicion de almacenamiento de un contrato contra su raiz.
    ///
    /// Sirve para leer estado de protocolos ajenos, como el mapa de reservas
    /// usadas de un pool de prestamos, sin que nadie lo afirme por fuera.
    pub fn preview_storage(
        &self,
        storage_root: B256,
        posicion: B256,
        prueba: Vec<Bytes>,
    ) -> Result<U256, Error> {
        let nodos: Vec<Vec<u8>> = prueba.into_iter().map(|b| b.to_vec()).collect();
        let clave = keccak(posicion.as_slice());
        let mut c = [0u8; 32];
        c.copy_from_slice(clave.as_slice());

        let valor = trie::buscar(storage_root.0, &c, &nodos)
            .map_err(|e| Error::PruebaInvalida(PruebaInvalida { motivo: codigo(e) }))?;
        // El valor de una posicion va envuelto en RLP como entero.
        let bruto = rlp::campo_suelto(&valor)
            .map_err(|_| Error::CuentaIlegible(CuentaIlegible {}))?;
        let mut b = [0u8; 32];
        if bruto.len() > 32 {
            return Err(Error::CuentaIlegible(CuentaIlegible {}));
        }
        b[32 - bruto.len()..].copy_from_slice(bruto);
        Ok(U256::from_be_bytes(b))
    }

    /// Cuantos campos trae la cabecera. Cambia con los forks de Nitro, y por eso
    /// el contrato lee por indice y nunca fija el total.
    pub fn header_fields(&self, cabecera_rlp: Bytes) -> Result<u64, Error> {
        rlp::cuantos(cabecera_rlp.as_slice())
            .map(|n| n as u64)
            .map_err(|_| Error::CabeceraIlegible(CabeceraIlegible {}))
    }
}

impl RemandAttest {
    /// Pregunta a ArbSys por el hash real del bloque.
    ///
    /// Se usa `arbBlockHash` y no el opcode BLOCKHASH porque en Nitro ese opcode
    /// devuelve un valor pseudoaleatorio, no el hash de la cabecera.
    fn hash_de_la_cadena(&self, numero: u64) -> Result<B256, Error> {
        let mut datos = Vec::with_capacity(36);
        datos.extend_from_slice(&SELECTOR_BLOCK_HASH);
        datos.extend_from_slice(&U256::from(numero).to_be_bytes::<32>());

        let salida = unsafe {
            static_call(self, Address::from(ARB_SYS), &datos)
                .map_err(|_| Error::FueraDeVentana(FueraDeVentana { numero }))?
        };
        if salida.len() != 32 {
            return Err(Error::FueraDeVentana(FueraDeVentana { numero }));
        }
        Ok(B256::from_slice(&salida))
    }
}


/// Traduce el fallo del recorrido a un codigo, para que el error de Solidity no
/// tenga que cargar una cadena de texto. Los codigos se documentan en el readme.
fn codigo(e: trie::TrieError) -> u8 {
    match e {
        trie::TrieError::HashNoCuadra => 1,
        trie::TrieError::NodoIlegible => 2,
        trie::TrieError::CaminoDivergente => 3,
        trie::TrieError::PruebaIncompleta => 4,
        trie::TrieError::NodoDesconocido => 5,
        trie::TrieError::NodoEmbebido => 6,
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    /// Cabecera real del bloque BLOQUE de Arbitrum One, capturada de la cadena.
    ///
    /// Probar el lector contra una cabecera inventada no demostraria nada: los
    /// campos de longitud variable y los enteros sin ceros a la izquierda son
    /// justo donde se rompe una implementacion de RLP.
    const CABECERA: &str = "0xf90224a0ebe8835478bb410ef2ef94e11dc5aa50255a4753309d96e43acc5a27f031f29ba01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794a4b000000000000000000073657175656e636572a03345b87b385af865b18c744b4174dbc9fdf34ee598ca0b6407c4ef63b0dee1e5a09b9ea884aae90492edc6343dd48642eb24a5febd36f26358a8b0ebef8c0c4b1aa0aeb9a845d1da0c9e0eb04de41f706ae8e3d99aa19f0e431a4bc23ab17947d8dbb901000000000000000000000000000000040000000000000000000000008000000000000000000000000000000000000000000000400000000000000000000000010000000001000000000000000800c80800000010000000000000000000000000000000000002000000080000040000080000040000000000000000001000000000000000000000000000000000000000000010000000000000000000000000000000000000018000000000000020000000000000000000000000000200000000000000000200000000002000002000000000000400040000000020000000002000000000000400000000000000000000000000000000000000000000000000000001841d62113787040000000000008301cc7d846a795628a0a1512d856f99d8e61b36e43f8c6b11737b4606322797e57d944364217bc6f029a0000000000002828d0000000001887d9500000000000000330000000000000000880000000000269fa58401315410";
    const BLOQUE: u64 = 492966199;
    const HASH: &str = "0x8b6d604651b4e40c6a799453434fe527faa2f4108d6797d333d0d3bbe6646f1d";
    const STATE_ROOT: &str = "0x3345b87b385af865b18c744b4174dbc9fdf34ee598ca0b6407c4ef63b0dee1e5";
    const RECEIPTS_ROOT: &str = "0xaeb9a845d1da0c9e0eb04de41f706ae8e3d99aa19f0e431a4bc23ab17947d8db";
    const CAMPOS: usize = 16;

    fn bytes() -> Vec<u8> {
        hex::decode(CABECERA.trim_start_matches("0x")).expect("muestra invalida")
    }

    fn esperado(s: &str) -> [u8; 32] {
        let v = hex::decode(s.trim_start_matches("0x")).expect("hex invalido");
        let mut a = [0u8; 32];
        a.copy_from_slice(&v);
        a
    }

    #[test]
    fn el_keccak_de_la_cabecera_es_el_hash_del_bloque() {
        // Esta es la prueba que sostiene todo el contrato. Si falla, el anclaje
        // sin oraculo no es posible y hay que replantear el diseno entero.
        let h = keccak(&bytes());
        assert_eq!(h.as_slice(), &esperado(HASH));
    }

    #[test]
    fn extrae_la_raiz_de_estado() {
        assert_eq!(cabecera::state_root(&bytes()).unwrap(), esperado(STATE_ROOT));
    }

    #[test]
    fn extrae_la_raiz_de_recibos() {
        assert_eq!(cabecera::receipts_root(&bytes()).unwrap(), esperado(RECEIPTS_ROOT));
    }

    #[test]
    fn lee_el_numero_que_declara_la_cabecera() {
        assert_eq!(cabecera::numero(&bytes()).unwrap(), BLOQUE);
    }

    #[test]
    fn cuenta_los_campos_de_la_cabecera() {
        // Se comprueba para documentar el fork vigente, no para exigirlo: si
        // Nitro anade un campo, el contrato debe seguir funcionando.
        assert_eq!(rlp::cuantos(&bytes()).unwrap(), CAMPOS);
    }

    #[test]
    fn una_cabecera_alterada_cambia_el_hash() {
        // Un byte distinto y el keccak deja de coincidir. Es lo que hace que
        // quien entrega la cabecera no tenga que ser de confianza.
        let mut b = bytes();
        let ultimo = b.len() - 1;
        b[ultimo] ^= 0x01;
        assert_ne!(keccak(&b).as_slice(), &esperado(HASH));
    }

    #[test]
    fn rechaza_rlp_truncado() {
        let b = bytes();
        let cortada = &b[..b.len() / 2];
        assert!(cabecera::state_root(cortada).is_err());
    }

    #[test]
    fn rechaza_lo_que_no_es_una_lista() {
        // Una cadena de bytes suelta no es una cabecera.
        let suelta = [0x83u8, 0x01, 0x02, 0x03];
        assert_eq!(rlp::campo(&suelta, 0), Err(rlp::RlpError::TipoInesperado));
    }

    #[test]
    fn rechaza_longitudes_con_ceros_a_la_izquierda() {
        // Aceptar codificacion no canonica daria dos representaciones para la
        // misma cabecera, es decir dos hashes distintos para el mismo bloque.
        let mala = [0xb8u8, 0x00, 0x01];
        assert!(rlp::campo(&mala, 0).is_err());
    }

    #[test]
    fn pedir_un_campo_que_no_existe_falla() {
        assert_eq!(rlp::campo(&bytes(), 99), Err(rlp::RlpError::FueraDeRango));
    }

    // --- prueba de cuenta contra una raiz real de Arbitrum One --------------

    const C_CABECERA: &str = "0xf90224a039375cb5abb74a54b242ede9a1c5b3d2990d3538c7ed3778bb9deeaa7de7640ca01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794a4b000000000000000000073657175656e636572a030d3209094a18a10b7813c6e7230d824a6461fafbee755188c3d454f89d73a65a0b00b89b87162d5fc2da300b5a3c39a100c44be82a885a51e2a5cc7a842af342aa057acd5638852a11136aae656d796a43ccaa185e8a4ac856608a7d9ddd71aa98db901000000000000000000000000000000800000200020000000400000000000000000002000000000000041204000300000100000800000000802200000000020200000000280800000000000000800000000401000100000000000608000000010000110040002000000000100000000080210000000080020000000003a0000000000000000000000000000000200000000000000000100000002400000000000080200000000000000000040000000028000000000004408000800000000000000000020060000000004000000000010000204000000080000c000000008002000001000000000000000000000040000000000020040000000000008000200000001841d621d358704000000000000830829e9846a79592fa0a3553cd1ef8b2ed69a4420ad95ceb8823ce4d3e20d06d4134585af89561a3beaa0000000000002828e0000000001887dd700000000000000330000000000000000880000000000269fb18401319290";
    const C_STATE_ROOT: &str = "0x30d3209094a18a10b7813c6e7230d824a6461fafbee755188c3d454f89d73a65";
    const C_0x39c7e5be19f99b178e38aa06f7799d517be89e92: &str = "0x39c7e5be19f99b178e38aa06f7799d517be89e92";
    const C_0x79ee675ccd41ef76491b2a220fcc69fad36a2b5903a563eae77e2dd5cc05feed: &str = "0x79ee675ccd41ef76491b2a220fcc69fad36a2b5903a563eae77e2dd5cc05feed";
    const C_19: u64 = 19;
    const C_PRUEBA: [&str; 9] = ["0xf90211a0bec5e5790dc294cef3eac7341c224505e16b115ea775ab027bd5f09fa3388c8ea0ce730227b2757abff341d5e9b02931b301a638bf2ace965a65364e6082638802a031313a161f904d7429cc295bdd07d40fdbfdb4c74b9397ad526aaec4edf60ee7a07d5ccc1379fea880cbed66c0d8c22a9a244a04a67a75476781363861a8f4515ba0a1f5113aebe4f469bb320f843ee2bc8c1cc56d706d6976e768cf69f8ae9d7e6ca042b3f5a00cacb744e82845db7eed3f862bf5e146a27c5d97303d4f135ea8d61fa0061db5aa1d6f824af7e774413755c487b1637ae3a79837a6822b8ad8e92a471ba04beb69cdcae309233b556c9d7cd9b6551d1b94acb82f1ca034780675733108aea08dfd79c1cdd077cf9636a0a07dca9e3ea752df48deb5bf2eae9be2c58296c7fba0c20dfe270d9b4a33c8ddb62d77dab68d563b43b07e5c898fee13a5fc3ede7baaa0d1e124a0f6fd527a278198ba2f009048387956b316bb43bf7b16a248cb93c431a0a0569a0c3426179ae6151c2456f92aa7ed285051a69dba431e0676326aa31ed7a06de2c9c78b2919082bc3da5238617988d764b6ed30e080a1cec7e17d761e88b3a038854689fd8041a3a241ee74ce6012b586e98da7c47149932615ade3775399dfa01c53768213632131c3d14adaab3c3b2ac5d25df52ed57a17e7b9a03eebbe70a1a0b7d9fecf7192c2d2a9d030f38300d9a8dcef0957e1c0a11c4de84aff766a1df380", "0xf90211a01b01628c650b872dbfe78896f873fa312f540e4cca838ba2a7e1229366187556a0c4a1c372dd6610511ace2c16f8362bd2bbfb32ee17d3e7b7f5d2d1a8c906322fa0400a1a9fcf3081fab609dddb97d3a043121c8f02a1cd62590da8ae1e082ae321a0c52826c099f981ba0325d39aacb0c886f8fd4ab9196a16715dc7ed1166946d3ea0b8754b742bf4ac675c6ee661f24dc0049de712bc7e56b0799d91c131b6e7284ba038a144df986fb2931dba9ce3c96b0723c24b522280877a76b71f9e73bf9e214aa00c18310cf5fb555b25f3e277071746da96ac192c7437e6d2affecd5cb42ff1a0a099d2661a94c5e76507e72ea3f03d1a6912ee9a8f316a0d207fd359491e3e14bfa0cf4d8b1a779a393112db19399dbb9ddfed3328db7a051b751513e98dc9b7f6aea0ca49bb6575654ff98fe4f7d1964420a623c23252acdc92b3cbbe00c2815fe00fa068eea2d5fd5bfe1d47b2e4a928ff090c97821daee3f5aabf67658d6c8701f0f2a0550ed250cb515acf988476d16a6d7583e18d7265e8217cb7574b9e3b1890c0a1a07077d7b3585978c63cff0a04d0983d7db748959f5a005f87477e01f324ae05ada0032aa0ff676a06a78271d861e237aecd208cf5e73a1346e064f5d5810bf60679a05bfced6070776abf9d287a72f27df412c987b6667d7f7948b4c8282ba26926bfa0ece1791adf658ca6c0eb17b65ce83e3728aaec09a594614e2547e030d3ae762d80", "0xf90211a0b751aa5aba40f98410071bd60f3a2dbde4defae1a0b38301a7e4a793526c4ef3a0b3273c77c6d33c480d91a83f23a2fc9835c426c1a88c1dd1839c993761c84feea019a509ee65ad15fa209288203689d89ae73cd70f5b3754d707cef8961e7710b8a0fb696c134684e0ce0b712170aacfa742f26875f133008857f81b89fb74f41205a0ea8d8652497995ff139b30c79abe1a2eeaf8dd2b20153add1e8a2be961add0baa0aa5ab5efc2c30842bae3158abf4c2b548dfee4f183836ad810d1cc31364e8417a00d03312e3970b4f9533c8b24cecfb893b5f34562d5e0d3e14795424180efaaeca0dc5d2aa3f182ff2ab3d5f88572de336a8e68036390df494b81b199beb8da881fa0e5cab43094a94553eceaa6a9e1c0c9525699cd6bf1d708319eaca4a6fad04c47a0e0c44930c9c041ec0c5cf9f874f669c758adf8b12da6adb390b15e44dd2654f7a0a698b99abf05f0c4b3140518142546653556d1cf0d65bfc99ee739fbb726c4e9a056e56a62bfc016681b73080fe6dacdbc967c34fd97364bcff0950fc1e0a6f78aa034f2428460db326f81cc5eacf211c1ffe2857f7d13391bf1a00ca0d661634c07a08c2718bfc44888cdc0022efc996c4605735d15bf69851a0b6847ba74298454dda003fd7da11d3b7485f8fab288e02ef40d9bf0bb5a651773e349af0abfd848a8a1a04dae7c40390787500eaca8772b1f756931b11efbcca89180e936bccc3974123e80", "0xf90211a08b91706d64117c4b418e1e038a7b5e6bfc62c58feea3959593bb62294f735737a04b23eab5c82c3a467bb43009ce0c9551faa3dac0ac7e335082bbb929fad29cbda0431e267acc2e102cda9140034ccf3a5294b501a779817d606f63c8e9a5ea934fa0867698c26fb8fda4243299b6318dc74fa41b83ebf90ff1da5576f41099254e32a0312e47919d4480f7681dc7b6e18cab8bd6b8ebd70fc52195ebc4ec0691716f08a05b4562f95d4cbbd6b03db2df173428382316ec9d40cf95b12aee3c7a9e7f2c92a0c70efa7e7f6e42c230b7d3fbe2a3be53b3031a2d2f35c883a61255a660c984c7a0304b74d110e62a46c29c6bccd08542ce46d5d577a97fc0abb27539735af8f428a09ae3f7b4b15df33453684a9e70e5f038044bfe3c22d06d53f13849cac5108de2a0cc02790fa7395de983a7d560368431e90316d7dcde822c325d93d28a86859317a00637d1464caae45a0ec26f44f932b59e250cd9cdde92e666d4bbfcb235ae6885a076d617bdff58a740e68ba4d5953b38bf099e6edd4f29d724f8b0728c3c9b25dfa085977c8523047fef76455c2ae9ba6cbd454c1277d00546b368f0cc8db5ca9000a04a93c733842fcaf1aa1af2f76db974513669732cf220531a8141295998fd1d4ea059e5c8f70f39664c48816d092444f166e6040552ee7294ff42faf04918f715cea0296e976e5f378ad3670750728d7685dfdeb080860aee529f4cf1ace14fee816480", "0xf90211a0b8f19ded42befb7923388903b86b0ff4241f3fdb31884832ef724d2acb75ce79a02d05a39876115a6405450b2c210d9609d2f8d20c7ce69142c280e587cae756f0a0823696771cd4b69c8f699e09766da5cb1acb277b024314987346908f628457c3a06a86655b72fc226da2ffcf4cafb3cb8928ff2932ab12df497ba9387c51c3a9c2a0a943416108709093259ac67ad8014be022d8b89743c6d010d56234ce66a8799ba01459c2dcd3e178c72a7e1998f7378e747079c1a3ef22a7f3909a268fef337eb4a09506bec3c51d6f164e9cccc8c3f886a2b10b8d5bd5ced6c74c67d60cf23c8b26a0cd13e542eb33a6e6616fdc0dd4da65d6dfd7c40a5c2d735b91865bddd29236f0a0f160736ebda360484d4e7b05fab20611539a8b7795a06090826cef585a764cbea08d8ea622ec59f7081a4afa8f7e8df6624df252a6da926fc825cf0670d0012e58a0dbef0a9aeb5f22c9f11892442676f4fadadab4313236595a5af9df254dddf84ea03a493dbfd11037be37c6d73f1747e5fb352e262a7c25b1f16ed75b70a2e68d26a0eedc8f4972dfc42e5cda3787e9ecc93278540a4f03c4ba9a8d4609802bc3c782a07c3c2bfca9766e1529d22076ebd5efee43e53b365823613aa625ec51b55767dda08d19435e1272835cccf08766019a78c386bec0399ff071e36e5865c014454e55a0034007a7b75468feddb3badcf8b99e81b9e7ce31052d93aa13b962d9f3accfd180", "0xf90211a05c892428320163aacdc6e2875de0a40e8c50684b57316b605f345905572d2480a08dbe49a38d9034751afca9ab22a27fa584440f698974e1d38a4f9d91c666c4aea07d42bea13f235e1e6c804ad61c37b32de0f5866635aed7b17623339a218eab80a0c82e41382ba70c805b3b8173077b134425956f7478b094b2fd96368b23cb3539a0ac703c4ac2a8b385f24ba68af2d85eb44c7d89fa0b751b19579da306441cc813a07065d9c10df0f0c456e13b5f3e2d27d2866b8e2ef126b9d96d81be30758da5faa06f3c95d7bab9aab6374bad9aa0da1583386933c2eeac64f8aa8e30d6a5791997a02694c28ec2b85ccbfa4771e7c22c9155685e2911bcddc8abefcd100bf010cae6a0c04d500f96520373ddfdbac934a3780488c51c331415dfb2f066d57d46b80343a044cf0b17103107e69dd35b87d571d593a8360a0953429025988361cf52bfc977a0dcdbb5ba07e0772245ad5e2b802121ec518fc751b50d7a9ebc7d2b11f2b303b2a02b9a289fa4ffbcb9b3686440cfc85a40cd6e4a18c55c54b8deb26700d3528c34a05e1db035545d57b35788321dc3db2f9a594093c5f50f4440b4459e5743d04890a0de0bd1b57d44f11051e677169e6263a8febfeedf3cb43da608d961d57c7abc08a06aa0da31b4aa0a1ec4fb665b7f2467ad708c595ee36c831500464f3bcf202d72a004c53918bcf81db56cf48d3c1ed29d9fc8f678781273c5594384a0b4dc4cc19880", "0xf8718080808080a035c0de71adcb360b881cc7891137b2308954c6e7c519a08ba020bf0e5a15c57ca049dabcde5ed2734904f08dac5cbff304c11434c192ae5d6e6a00875e897d3c2980808080a0d42bd7876b14ec85adc31392cec189c8df0dfd490d1baf85f0cabe9f37535c818080808080", "0xf85180808080808080808080a0b5ef01f334bb345d03ac71d70aa115e551e9c76e6f6dca7dc1747529fbba691e80a07dd287f7001be67a424d2db1ee14936c67e1e178ee0f348e64a2b1871fffa9a880808080", "0xf86d9d20cd41ef76491b2a220fcc69fad36a2b5903a563eae77e2dd5cc05feedb84df84b138748f3cf924cc486a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a0c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"];

    fn nodos() -> Vec<Vec<u8>> {
        C_PRUEBA
            .iter()
            .map(|n| hex::decode(n.trim_start_matches("0x")).expect("nodo invalido"))
            .collect()
    }

    fn camino() -> [u8; 32] {
        let v = hex::decode(C_0x79ee675ccd41ef76491b2a220fcc69fad36a2b5903a563eae77e2dd5cc05feed.trim_start_matches("0x")).unwrap();
        let mut a = [0u8; 32];
        a.copy_from_slice(&v);
        a
    }

    #[test]
    fn el_camino_es_el_keccak_de_la_direccion() {
        // Si esto se confunde con la direccion cruda, el recorrido nunca cuadra
        // y el error parece de la prueba y no del camino.
        let w = hex::decode(C_0x39c7e5be19f99b178e38aa06f7799d517be89e92.trim_start_matches("0x")).unwrap();
        assert_eq!(keccak(&w).as_slice(), &camino());
    }

    #[test]
    fn demuestra_el_nonce_de_una_cuenta_ajena() {
        // La prueba central de la etapa: ningun opcode del EVM puede hacer esto.
        let valor = trie::buscar(esperado(C_STATE_ROOT), &camino(), &nodos()).unwrap();
        let c = cuenta::decodificar(&valor).unwrap();
        assert_eq!(c.nonce, C_19);
    }

    #[test]
    fn la_raiz_de_la_prueba_sale_de_la_cabecera() {
        // Cierra el circulo: la raiz contra la que se verifica no es un
        // parametro suelto, es la que lleva dentro una cabecera cuyo keccak
        // coincide con el hash que da la cadena.
        let cab = hex::decode(C_CABECERA.trim_start_matches("0x")).unwrap();
        assert_eq!(cabecera::state_root(&cab).unwrap(), esperado(C_STATE_ROOT));
    }

    #[test]
    fn un_nodo_alterado_rompe_la_cadena_de_hashes() {
        let mut n = nodos();
        let ultimo = n.len() - 1;
        let largo = n[ultimo].len();
        n[ultimo][largo - 1] ^= 0x01;
        assert_eq!(
            trie::buscar(esperado(C_STATE_ROOT), &camino(), &n),
            Err(trie::TrieError::HashNoCuadra)
        );
    }

    #[test]
    fn una_raiz_distinta_no_verifica() {
        let mut r = esperado(C_STATE_ROOT);
        r[0] ^= 0xff;
        assert_eq!(
            trie::buscar(r, &camino(), &nodos()),
            Err(trie::TrieError::HashNoCuadra)
        );
    }

    #[test]
    fn una_prueba_truncada_no_llega_al_valor() {
        let n = nodos();
        let corta = &n[..n.len() - 1];
        assert!(trie::buscar(esperado(C_STATE_ROOT), &camino(), corta).is_err());
    }

    #[test]
    fn no_se_puede_probar_otra_direccion_con_esta_prueba() {
        // Reutilizar una prueba valida para una wallet distinta tiene que fallar,
        // o cualquiera copiaria la prueba del vecino.
        let mut otra = camino();
        otra[0] ^= 0xff;
        assert!(trie::buscar(esperado(C_STATE_ROOT), &otra, &nodos()).is_err());
    }
}
