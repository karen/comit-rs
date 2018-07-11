use bitcoin_support::{Hash160, PubkeyHash, Script};
use secp256k1_support::{SecretKey, ToPublicKey};
use witness::{Witness, WitnessMethod};

pub struct WitnessP2pkh(pub SecretKey);

impl WitnessP2pkh {
    /// Utility function to generate the `prev_script` for a p2wpkh adddress.
    /// A standard p2wpkh locking script of:
    /// 00 14 <public_key_hash>
    /// becomes
    /// 19 76 a9 14 <public_key_hash> 88 ac
    /// in the unlocking script. See BIP 143.
    /// This function simply returns the latter as a Script.
    pub fn generate_prev_script(public_key_hash: &PubkeyHash) -> Script {
        let public_key_hash: Hash160 = public_key_hash.clone().into();

        let mut prev_script = vec![0x76, 0xa9, 0x14];

        prev_script.append(&mut public_key_hash[..].to_vec());
        prev_script.push(0x88);
        prev_script.push(0xac);

        Script::from(prev_script)
    }
}

impl WitnessMethod for WitnessP2pkh {
    fn into_witness(self) -> Vec<Witness> {
        vec![
            Witness::Signature(self.0),
            Witness::PublicKey(self.0.to_public_key()),
        ]
    }

    fn sequence(&self) -> u32 {
        super::SEQUENCE_ALLOW_NTIMELOCK_NO_RBF
    }

    fn prev_script(&self) -> Script {
        let public_key = self.0.to_public_key();
        Self::generate_prev_script(&public_key.into())
    }
}

#[cfg(test)]
mod test {
    use bitcoin_support::PrivateKey;
    use std::str::FromStr;
    extern crate hex;
    use super::*;
    #[test]
    fn correct_prev_script() {
        let private_key =
            PrivateKey::from_str("L4r4Zn5sy3o5mjiAdezhThkU37mcdN4eGp4aeVM4ZpotGTcnWc6k").unwrap();
        let secret_key = private_key.secret_key();
        let witness_method = WitnessP2pkh(secret_key.clone());

        // Note: You might expect it to be a is_p2wpkh() but it shouldn't be.
        assert!(
            witness_method.prev_script().is_p2pkh(),
            "prev_script should be a p2pkh"
        );
    }

}
