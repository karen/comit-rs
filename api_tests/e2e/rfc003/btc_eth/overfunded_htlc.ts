import "chai/register-should";
import { ethers } from "ethers";
import { Actor } from "../../../lib/actor";
import * as bitcoin from "../../../lib/bitcoin";
import "../../../lib/setup_chai";
import { createTests, mapToAction, Step } from "../../../lib/test_creator";
import { HarnessGlobal } from "../../../lib/util";
import {
    ActionKind,
    CreateSwapRequestPayload,
    LedgerAction,
} from "../../../lib2/cnd_http_api";
import { hasAction } from "../../../lib2/create_actors";

declare var global: HarnessGlobal;

(async function() {
    const alice = new Actor("alice", {
        ledgerConfig: global.ledgerConfigs,
        addressForIncomingBitcoinPayments:
            "bcrt1qs2aderg3whgu0m8uadn6dwxjf7j3wx97kk2qqtrum89pmfcxknhsf89pj0",
    });
    const bob = new Actor("bob", {
        ledgerConfig: global.ledgerConfigs,
    });

    const alphaAssetQuantity = 100000000;
    const overFundedAlphaAssetQuantity = 1000000000;
    const betaAssetQuantity = ethers.utils.parseEther("10");
    const maxFeeInSatoshi = 50000;

    const alphaExpiry = Math.round(Date.now() / 1000) + 13;
    const betaExpiry = Math.round(Date.now() / 1000) + 8;

    await bitcoin.ensureFunding();
    await bob.wallet.eth().fund("11");
    await alice.wallet.eth().fund("0.1");
    await alice.wallet.btc().fund(20);
    await bitcoin.generate();

    const swapRequest: CreateSwapRequestPayload = {
        alpha_ledger: {
            name: "bitcoin",
            network: "regtest",
        },
        beta_ledger: {
            name: "ethereum",
            network: "regtest",
        },
        alpha_asset: {
            name: "bitcoin",
            quantity: alphaAssetQuantity.toString(),
        },
        beta_asset: {
            name: "ether",
            quantity: betaAssetQuantity.toString(),
        },
        beta_ledger_redeem_identity: alice.wallet.eth().address(),
        alpha_expiry: alphaExpiry,
        beta_expiry: betaExpiry,
        peer: await bob.peerId(),
    };

    const steps: Step[] = [
        {
            actor: bob,
            action: ActionKind.Accept,
            waitUntil: state => state.communication.status === "ACCEPTED",
        },
        // given an over-funded HTLC
        {
            actor: alice,
            action: {
                description: "can overfund the bitcoin HTLC",
                exec: async (actor, swapHref) => {
                    const sirenAction = await actor
                        .pollCndUntil(swapHref, hasAction(ActionKind.Fund))
                        .then(mapToAction(ActionKind.Fund));

                    const response = await actor.doComitAction(sirenAction);
                    const ledgerAction = response.body as LedgerAction;

                    if (
                        !(
                            "bitcoin-send-amount-to-address" ===
                            ledgerAction.type
                        )
                    ) {
                        throw new Error(
                            `Expected ledger action to be 'bitcoin-send-amount-to-address' but was '${ledgerAction.type}'`
                        );
                    }

                    ledgerAction.payload.amount = new ethers.utils.BigNumber(
                        overFundedAlphaAssetQuantity
                    ).toString();

                    await actor.doLedgerAction(ledgerAction);
                },
            },
        },
        // alice should not consider the HTLC to be funded and terminate with NOT_SWAPPED
        {
            actor: alice,
            waitUntil: state =>
                state.alpha_ledger.status === "INCORRECTLY_FUNDED",
        },
        // bob should not consider the HTLC to be funded and terminate with NOT_SWAPPED
        {
            actor: bob,
            waitUntil: state =>
                state.alpha_ledger.status === "INCORRECTLY_FUNDED" &&
                state.beta_ledger.status === "NOT_DEPLOYED",
        },
        {
            actor: alice,
            action: ActionKind.Refund,
        },
        {
            actor: alice,
            waitUntil: state =>
                state.alpha_ledger.status === "REFUNDED" &&
                state.beta_ledger.status === "NOT_DEPLOYED",
            test: {
                description:
                    "Should have received the alpha asset after the refund",
                callback: async body => {
                    const refundTxId =
                        body.properties.state.alpha_ledger.refund_tx;

                    const satoshiReceived = await alice.wallet
                        .btc()
                        .satoshiReceivedInTx(refundTxId);
                    const satoshiExpected =
                        overFundedAlphaAssetQuantity - maxFeeInSatoshi;

                    satoshiReceived.should.be.at.least(satoshiExpected);
                },
            },
        },
    ];

    describe("RFC003: Bitcoin for Ether - overfunded alpha HTLC", async () => {
        createTests(alice, bob, steps, "/swaps/rfc003", "/swaps", swapRequest);
    });
    run();
})();
