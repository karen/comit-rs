import { getLogger } from "log4js";
import { createActors } from "../../../lib2/create_actors";

setTimeout(function() {
    describe("happy path", () => {
        it("bitcoin ether", async () => {
            const { alice, bob } = await createActors(
                getLogger("e2e/rfc003/btc_eth/happy.ts")
            );

            await alice.sendRequest("bitcoin", "ether");
            await bob.accept();
            await alice.fund();
            await bob.fund();
            await alice.redeem();
            await bob.redeem();
        });
    });
    run();
}, 0);

//
// (async function() {
//     const alice = new Actor("alice", global.config, global.project_root, {
//         ethereumNodeConfig: global.ledgers_config.ethereum,
//         bitcoinNodeConfig: global.ledgers_config.bitcoin,
//         addressForIncomingBitcoinPayments: null,
//     });
//     const bob = new Actor("bob", global.config, global.project_root, {
//         ethereumNodeConfig: global.ledgers_config.ethereum,
//         bitcoinNodeConfig: global.ledgers_config.bitcoin,
//         addressForIncomingBitcoinPayments:
//             "bcrt1qs2aderg3whgu0m8uadn6dwxjf7j3wx97kk2qqtrum89pmfcxknhsf89pj0",
//     });
//
//     const alphaAssetQuantity = 100000000;
//     const betaAssetQuantity = ethers.utils.parseEther("10");
//     const maxFeeInSatoshi = 50000;
//
//     const alphaExpiry = new Date("2080-06-11T23:00:00Z").getTime() / 1000;
//     const betaExpiry = ;
//
//     await bitcoin.ensureFunding();
//     await bob.wallet.eth().fund("11");
//     await alice.wallet.eth().fund("0.1");
//     await alice.wallet.btc().fund(10);
//     await bitcoin.generate();
//
//     const aliceEthBalanceBefore = await alice.wallet.eth().ethBalance();
//
//     const swapRequest: CreateSwapRequestPayload = {
//         alpha_ledger: {
//             name: "bitcoin",
//             network: "regtest",
//         },
//         beta_ledger: {
//             name: "ethereum",
//             network: "regtest",
//         },
//         alpha_asset: {
//             name: "bitcoin",
//             quantity: alphaAssetQuantity.toString(),
//         },
//         beta_asset: {
//             name: "ether",
//             quantity: betaAssetQuantity.toString(),
//         },
//         beta_ledger_redeem_identity: alice.wallet.eth().address(),
//         alpha_expiry: alphaExpiry,
//         beta_expiry: betaExpiry,
//         peer: await bob.peerId(),
//     };
//
//     const steps: Step[] = [
//         {
//             actor: bob,
//             action: ActionKind.Accept,
//             waitUntil: state => state.communication.status === "ACCEPTED",
//         },
//         {
//             actor: alice,
//             action: ActionKind.Fund,
//             waitUntil: state => state.alpha_ledger.status === "FUNDED",
//         },
//         {
//             actor: bob,
//             action: ActionKind.Fund,
//             waitUntil: state => state.beta_ledger.status === "FUNDED",
//         },
//         {
//             actor: alice,
//             action: ActionKind.Redeem,
//             waitUntil: state => state.beta_ledger.status === "REDEEMED",
//             test: {
//                 description:
//                     "Should have received the beta asset after the redeem",
//                 callback: async () => {
//                     const aliceEthBalanceAfter = await alice.wallet
//                         .eth()
//                         .ethBalance();
//                     const aliceEthBalanceExpected = aliceEthBalanceBefore.add(
//                         betaAssetQuantity
//                     );
//                     aliceEthBalanceAfter
//                         .eq(aliceEthBalanceExpected)
//                         .should.be.equal(true);
//                 },
//             },
//         },
//         {
//             actor: bob,
//             action: ActionKind.Redeem,
//             waitUntil: state => state.alpha_ledger.status === "REDEEMED",
//             test: {
//                 description:
//                     "Should have received the alpha asset after the redeem",
//                 callback: async body => {
//                     const redeemTxId =
//                         body.properties.state.alpha_ledger.redeem_tx;
//
//                     const satoshiReceived = await bob.wallet
//                         .btc()
//                         .satoshiReceivedInTx(redeemTxId);
//                     const satoshiExpected =
//                         alphaAssetQuantity - maxFeeInSatoshi;
//
//                     satoshiReceived.should.be.at.least(satoshiExpected);
//                 },
//             },
//         },
//     ];
//
//     describe("RFC003: Bitcoin for Ether", async () => {
//         createTests(alice, bob, steps, "/swaps/rfc003", "/swaps", swapRequest);
//     });
//     run();
// })();
