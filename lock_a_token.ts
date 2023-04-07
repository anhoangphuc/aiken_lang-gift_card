import {
  Blockfrost,
  Constr,
  Data,
  fromText,
  Lucid,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { applyParams, readValidators } from "./utils.ts";

const lucid = await Lucid.new(
  new Blockfrost(
    "https://cardano-preview.blockfrost.io/api/v0",
    "previewuk8aqs7MMnoR2ORPPftH25MDnToSJxg1",
  ),
  "Preview",
);

async function submitTokenName(tokenName: string) {
  const utxos = await lucid?.wallet.getUtxos()!;
  const utxo = utxos[0];
  const outputReference = {
    txHash: utxo.txHash,
    outputIndex: utxo.outputIndex,
  };

  const validators = await readValidators();
  const contracts = applyParams(
    tokenName,
    outputReference,
    validators,
    lucid!,
  );
  return contracts;
}

async function createGiftCard() {
    const tokenName = "Token0";
    const contracts = await submitTokenName(tokenName);

    const lovelace = BigInt(1000000000);
    const assetName = `${contracts.policyId}${fromText(tokenName)}`;

    const mintRedeemer = Data.to(new Constr(0, []));

    const utxos = await lucid.wallet.getUtxos()!;
    const utxo = utxos[0];

    const tx = await lucid.newTx()
        .collectFrom([utxo])
        .attachMintingPolicy(contracts.giftCard)
        .mintAssets({ [assetName]: BigInt(1) }, mintRedeemer)
        .payToContract(contracts.lockAddress, { inline: Data.void() }, { lovelace })
        .complete();

    const txSigned = await tx.sign().complete();
    const txHash = await txSigned.submit();

    await lucid.awaitTx(txHash);
    console.log(`Create gift card success with tx ${txHash}`);
}

async function redeemGiftCard (){
    const tokenName = "Token0";
    const contracts = await submitTokenName(tokenName);
    const utxos = await lucid.utxosAt(contracts.lockAddress);

    const assetName = `${contracts.policyId}${fromText(tokenName)}`

    const burnRedeemer = Data.to(new Constr(1, []));

    const tx = await lucid.newTx().collectFrom(utxos, Data.void())
        .attachMintingPolicy(contracts.giftCard)
        .attachSpendingValidator(contracts.redeem)
        .mintAssets(
            { [assetName]: BigInt(-1)}, burnRedeemer,)
        .complete()

    const txSigned = await tx.sign().complete();
    const txHash = await txSigned.submit();
    await lucid.awaitTx(txHash);

    console.log(`Redeem gift card success with tx ${txHash}`);
}

const param = Deno.args[0];
if (param === "create"){
    await createGiftCard();
} else if (param === "redeem") {
    await redeemGiftCard();
} else {
    throw new Error("Invalid param");
}