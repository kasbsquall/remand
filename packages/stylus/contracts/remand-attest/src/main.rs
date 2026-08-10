#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(feature = "export-abi")]
fn main() {
    remand_attest::print_from_args();
}

#[cfg(not(feature = "export-abi"))]
fn main() {}
