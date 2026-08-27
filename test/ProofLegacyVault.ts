import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("ProofLegacyVault", async function () {
  const connection = await network.connect();
  const { viem } = connection;
  const provider = connection.provider;

  async function createClaimedVault() {
    const [owner, beneficiary] = await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;
    const warningDuration = 14n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await owner.sendTransaction({
      to: vault.address,
      value: 1n * 10n ** 18n,
    });

    await provider.send("evm_increaseTime", [Number(inactivityPeriod)]);
    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    await provider.send("evm_increaseTime", [Number(warningDuration)]);
    await provider.send("evm_mine");

    await vault.write.claim({
      account: beneficiary.account,
    });

    return { vault, owner, beneficiary };
  }

  it("sets the owner and beneficiary correctly", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();
    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    assert.equal(
      (await vault.read.owner()).toLowerCase(),
      owner.account.address.toLowerCase()
    );

    assert.equal(
      (await vault.read.beneficiary()).toLowerCase(),
      beneficiary.account.address.toLowerCase()
    );
  });

  it("rejects a zero address beneficiary", async function () {
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const inactivityPeriod = 90n * 24n * 60n * 60n;

    await assert.rejects(
      viem.deployContract("ProofLegacyVault", [
        zeroAddress,
        inactivityPeriod,
      ])
    );
  });

  it("rejects a zero inactivity period", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();

    await assert.rejects(
      viem.deployContract("ProofLegacyVault", [
        beneficiary.account.address,
        0n,
      ])
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

    await provider.send("evm_increaseTime", [Number(inactivityPeriod)]);
    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    assert.equal(await vault.read.warningPeriod(), true);
  });

  it("does not allow the warning period to start twice", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();
    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await provider.send("evm_increaseTime", [Number(inactivityPeriod)]);
    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    await assert.rejects(
      vault.write.startWarningPeriod({
        account: beneficiary.account,
      })
    );

    assert.equal(await vault.read.warningPeriod(), true);
  });

  it("allows the owner to cancel the warning by pinging", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();
    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await provider.send("evm_increaseTime", [Number(inactivityPeriod)]);
    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    await vault.write.ping({
      account: owner.account,
    });

    assert.equal(await vault.read.warningPeriod(), false);
    assert.equal(await vault.read.warningStartedAt(), 0n);
  });

  it("does not allow a non-owner to ping", async function () {
    const [owner, beneficiary, attacker] =
      await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    const before = await vault.read.lastProofOfLife();

    await assert.rejects(
      vault.write.ping({
        account: attacker.account,
      })
    );

    const after = await vault.read.lastProofOfLife();

    assert.equal(after, before);
  });

  it("does not allow the beneficiary to claim before the warning period ends", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();
    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await provider.send("evm_increaseTime", [Number(inactivityPeriod)]);
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

  it("does not allow a non-beneficiary to claim", async function () {
    const [owner, beneficiary, attacker] =
      await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;
    const warningDuration = 14n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await owner.sendTransaction({
      to: vault.address,
      value: 1n * 10n ** 18n,
    });

    await provider.send("evm_increaseTime", [Number(inactivityPeriod)]);
    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    await provider.send("evm_increaseTime", [Number(warningDuration)]);
    await provider.send("evm_mine");

    await assert.rejects(
      vault.write.claim({
        account: attacker.account,
      })
    );

    assert.equal(await vault.read.claimed(), false);
  });

  it("allows the beneficiary to claim after the warning period ends", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();
    const inactivityPeriod = 90n * 24n * 60n * 60n;
    const warningDuration = 14n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await owner.sendTransaction({
      to: vault.address,
      value: 1n * 10n ** 18n,
    });

    await provider.send("evm_increaseTime", [Number(inactivityPeriod)]);
    await provider.send("evm_mine");

    await vault.write.startWarningPeriod({
      account: beneficiary.account,
    });

    await provider.send("evm_increaseTime", [Number(warningDuration)]);
    await provider.send("evm_mine");

    const balanceBefore = BigInt(
      await provider.request({
        method: "eth_getBalance",
        params: [beneficiary.account.address, "latest"],
      })
    );

    await vault.write.claim({
      account: beneficiary.account,
    });

    const balanceAfter = BigInt(
      await provider.request({
        method: "eth_getBalance",
        params: [beneficiary.account.address, "latest"],
      })
    );

    assert(balanceAfter > balanceBefore);
    assert.equal(await vault.read.claimed(), true);
  });

  it("does not allow the beneficiary to claim twice", async function () {
    const { vault, beneficiary } = await createClaimedVault();

    await assert.rejects(
      vault.write.claim({
        account: beneficiary.account,
      })
    );
  });

  it("does not allow a claimed vault to be pinged", async function () {
    const { vault, owner } = await createClaimedVault();

    await assert.rejects(
      vault.write.ping({
        account: owner.account,
      })
    );
  });

  it("does not allow a claimed vault to update the beneficiary", async function () {
    const [owner, beneficiary, newBeneficiary] =
      await viem.getWalletClients();

    const { vault } = await createClaimedVault();

    await assert.rejects(
      vault.write.updateBeneficiary(
        [newBeneficiary.account.address],
        {
          account: owner.account,
        }
      )
    );

    assert.equal(
      (await vault.read.beneficiary()).toLowerCase(),
      beneficiary.account.address.toLowerCase()
    );
  });

  it("does not allow a claimed vault to start a warning period", async function () {
    const { vault, beneficiary } = await createClaimedVault();

    await assert.rejects(
      vault.write.startWarningPeriod({
        account: beneficiary.account,
      })
    );

    assert.equal(await vault.read.claimed(), true);
  });

  it("allows the owner to update the beneficiary", async function () {
    const [owner, beneficiary, newBeneficiary] =
      await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await vault.write.updateBeneficiary(
      [newBeneficiary.account.address],
      {
        account: owner.account,
      }
    );

    assert.equal(
      (await vault.read.beneficiary()).toLowerCase(),
      newBeneficiary.account.address.toLowerCase()
    );
  });

  it("does not allow the owner to update the beneficiary to zero address", async function () {
    const [owner, beneficiary] = await viem.getWalletClients();
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await assert.rejects(
      vault.write.updateBeneficiary(
        [zeroAddress],
        {
          account: owner.account,
        }
      )
    );

    assert.equal(
      (await vault.read.beneficiary()).toLowerCase(),
      beneficiary.account.address.toLowerCase()
    );
  });

  it("does not allow a non-owner to update the beneficiary", async function () {
    const [owner, beneficiary, attacker] =
      await viem.getWalletClients();

    const inactivityPeriod = 90n * 24n * 60n * 60n;

    const vault = await viem.deployContract("ProofLegacyVault", [
      beneficiary.account.address,
      inactivityPeriod,
    ]);

    await assert.rejects(
      vault.write.updateBeneficiary(
        [attacker.account.address],
        {
          account: attacker.account,
        }
      )
    );

    assert.equal(
      (await vault.read.beneficiary()).toLowerCase(),
      beneficiary.account.address.toLowerCase()
    );
  });
});