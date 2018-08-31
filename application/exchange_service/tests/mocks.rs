extern crate bitcoin_rpc_client;
extern crate ethereum_support;
extern crate exchange_service;
extern crate reqwest;

use bitcoin_rpc_client::{
    Address, BitcoinRpcApi, RpcError, SerializedRawTransaction, TransactionId,
};
use ethereum_support::{web3, Bytes, H256};
use exchange_service::ethereum_service::BlockingEthereumApi;

pub struct BitcoinRpcClientMock {
    transaction_id: TransactionId,
}

impl BitcoinRpcClientMock {
    pub fn new(transaction_id: TransactionId) -> Self {
        BitcoinRpcClientMock { transaction_id }
    }
}

#[allow(unused_variables)]
impl BitcoinRpcApi for BitcoinRpcClientMock {
    fn send_raw_transaction(
        &self,
        _raw_transaction: SerializedRawTransaction,
    ) -> Result<Result<TransactionId, RpcError>, reqwest::Error> {
        Ok(Ok(self.transaction_id.clone()))
    }
    fn send_to_address(
        &self,
        _address: &Address,
        _amount: f64,
    ) -> Result<Result<TransactionId, RpcError>, reqwest::Error> {
        Ok(Ok(self.transaction_id.clone()))
    }
}

pub struct StaticEthereumApi;

impl BlockingEthereumApi for StaticEthereumApi {
    fn send_raw_transaction(&self, _rlp: Bytes) -> Result<H256, web3::Error> {
        Ok(H256::new())
    }
}
