import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("ProofLegacyVault", async function () {
  const { viem, provider } = await network.connect();

  it("sets the owner and beneficiary correctly", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    const actualOwner = await vault.read.owner();
    const actualBeneficiary = await vault.read.beneficiary();

    assert.equal(
      actualOwner.toLowerCase(),
      owner.account.address.toLowerCase()
    );

    assert.equal(
      actualBeneficiary.toLowerCase(),
      beneficiary.account.address.toLowerCase()
    );
  });

  it("does not allow the warning period to start while the owner is active", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await assert.rejects(
      vault.write.startWarningPeriod({
        account: beneficiary.account,
      })
    );
  });

  it("allows the warning period to start after inactivity", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await provider.send("evm_increaseTime", [
      Number(inactivityPeriod),
    ]);

    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    assert.equal(await vault.read.warningPeriod(), true);
  });

  it("allows the owner to cancel the warning by pinging", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await provider.send("evm_increaseTime", [
      Number(inactivityPeriod),
    ]);

    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    assert.equal(await vault.read.warningPeriod(), true);

    await vault.write.ping({
      account: owner.account,
    });

    assert.equal(await vault.read.warningPeriod(), false);
  });

  it("does not allow the beneficiary to claim before the warning period ends", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await provider.send("evm_increaseTime", [
      Number(inactivityPeriod),
    ]);

    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    await assert.rejects(
      vault.write.claim({
        account: beneficiary.account,
      })
    );
  });
});