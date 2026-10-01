const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HealthRecords Smart Contract", function () {
  let healthRecords;
  let owner, patient, doctor1, doctor2, unauthorizedUser;

  // Sample SHA-256 hashes (32 bytes)
  const sampleHash1 = ethers.keccak256(ethers.toUtf8Bytes("Report-Doc-101-Tanmay-Shishodia-Blood-Panel"));
  const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("Report-Doc-102-Tanmay-Shishodia-Prescription"));
  const dummyHash = ethers.keccak256(ethers.toUtf8Bytes("Unregistered-Report-Tampered"));

  beforeEach(async function () {
    [owner, patient, doctor1, doctor2, unauthorizedUser] = await ethers.getSigners();

    const HealthRecordsFactory = await ethers.getContractFactory("HealthRecords");
    healthRecords = await HealthRecordsFactory.deploy();
    await healthRecords.waitForDeployment();
  });

  describe("1. Record Registration", function () {
    it("Should register a new record hash and emit RecordAdded event", async function () {
      const tx = await healthRecords.connect(patient).registerRecord(sampleHash1);
      const receipt = await tx.wait();

      // Verify event emission
      await expect(tx)
        .to.emit(healthRecords, "RecordAdded")
        .withArgs(patient.address, sampleHash1, (await ethers.provider.getBlock(receipt.blockNumber)).timestamp);

      // Verify on-chain tamper detection returns true
      expect(await healthRecords.verifyRecord(sampleHash1)).to.equal(true);

      // Verify record details
      const details = await healthRecords.getRecordDetails(sampleHash1);
      expect(details.owner).to.equal(patient.address);
      expect(details.timestamp).to.be.gt(0);
    });

    it("Should revert when registering an already registered hash", async function () {
      await healthRecords.connect(patient).registerRecord(sampleHash1);

      await expect(
        healthRecords.connect(patient).registerRecord(sampleHash1)
      ).to.be.revertedWith("Record hash already registered");
    });

    it("Should revert when registering a zero hash", async function () {
      await expect(
        healthRecords.connect(patient).registerRecord(ethers.ZeroHash)
      ).to.be.revertedWith("Invalid record hash");
    });
  });

  describe("2. Granular Access Control (Grant & Revoke)", function () {
    it("Should allow patient to grant access to a doctor and emit AccessGranted", async function () {
      expect(await healthRecords.hasAccess(patient.address, doctor1.address)).to.equal(false);

      const tx = await healthRecords.connect(patient).grantAccess(doctor1.address);
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(healthRecords, "AccessGranted")
        .withArgs(patient.address, doctor1.address, (await ethers.provider.getBlock(receipt.blockNumber)).timestamp);

      expect(await healthRecords.hasAccess(patient.address, doctor1.address)).to.equal(true);
      expect(await healthRecords.hasAccess(patient.address, doctor2.address)).to.equal(false);
    });

    it("Patient should always have access to their own records", async function () {
      expect(await healthRecords.hasAccess(patient.address, patient.address)).to.equal(true);
    });

    it("Should allow patient to revoke doctor access and emit AccessRevoked", async function () {
      await healthRecords.connect(patient).grantAccess(doctor1.address);
      expect(await healthRecords.hasAccess(patient.address, doctor1.address)).to.equal(true);

      const tx = await healthRecords.connect(patient).revokeAccess(doctor1.address);
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(healthRecords, "AccessRevoked")
        .withArgs(patient.address, doctor1.address, (await ethers.provider.getBlock(receipt.blockNumber)).timestamp);

      expect(await healthRecords.hasAccess(patient.address, doctor1.address)).to.equal(false);
    });

    it("Should revert if granting access to self or zero address", async function () {
      await expect(
        healthRecords.connect(patient).grantAccess(patient.address)
      ).to.be.revertedWith("Cannot grant access to self");

      await expect(
        healthRecords.connect(patient).grantAccess(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid doctor address");
    });
  });

  describe("3. Tamper Verification & Record Retrieval", function () {
    beforeEach(async function () {
      await healthRecords.connect(patient).registerRecord(sampleHash1);
      await healthRecords.connect(patient).registerRecord(sampleHash2);
    });

    it("Should accurately verify existing vs non-existent hashes", async function () {
      expect(await healthRecords.verifyRecord(sampleHash1)).to.equal(true);
      expect(await healthRecords.verifyRecord(sampleHash2)).to.equal(true);
      expect(await healthRecords.verifyRecord(dummyHash)).to.equal(false);
    });

    it("A patient's records are listed from the RecordAdded events (no growing array in storage)", async function () {
      const events = await healthRecords.queryFilter(healthRecords.filters.RecordAdded(patient.address));
      expect(events.map((e) => e.args.fileHash)).to.deep.equal([sampleHash1, sampleHash2]);
      const details = await healthRecords.getRecordDetails(sampleHash2);
      expect(details.owner).to.equal(patient.address);
      expect(details.timestamp).to.equal((await ethers.provider.getBlock(events[1].blockNumber)).timestamp);
    });

    it("Unknown records have no details", async function () {
      await expect(healthRecords.getRecordDetails(dummyHash)).to.be.revertedWith("Record does not exist");
    });
  });

  describe("4. Immutable Audit Trail Logging", function () {
    it("Should log access and emit AccessLogged event", async function () {
      const action = "Dr. Gregory House reviewed CBC Lab Report";
      const tx = await healthRecords.connect(doctor1).logAccess(patient.address, action);
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(healthRecords, "AccessLogged")
        .withArgs(patient.address, doctor1.address, action, (await ethers.provider.getBlock(receipt.blockNumber)).timestamp);
    });

    it("Should revert logAccess with empty action or invalid patient", async function () {
      await expect(
        healthRecords.connect(doctor1).logAccess(patient.address, "")
      ).to.be.revertedWith("Action cannot be empty");

      await expect(
        healthRecords.connect(doctor1).logAccess(ethers.ZeroAddress, "Reviewed Record")
      ).to.be.revertedWith("Invalid patient address");
    });
  });

  describe("5. Relayer (patients without a wallet)", function () {
    it("Deployer is the relayer", async function () {
      expect(await healthRecords.relayer()).to.equal(owner.address);
    });

    it("Relayer registers a record for a patient", async function () {
      await expect(healthRecords.connect(owner).registerRecordFor(patient.address, sampleHash1))
        .to.emit(healthRecords, "RecordAdded");
      expect(await healthRecords.verifyRecord(sampleHash1)).to.equal(true);
      const details = await healthRecords.getRecordDetails(sampleHash1);
      expect(details.owner).to.equal(patient.address);
    });

    it("Relayer grants and revokes on a patient's behalf", async function () {
      await expect(healthRecords.connect(owner).grantAccessFor(patient.address, doctor1.address))
        .to.emit(healthRecords, "AccessGranted");
      expect(await healthRecords.hasAccess(patient.address, doctor1.address)).to.equal(true);
      await expect(healthRecords.connect(owner).revokeAccessFor(patient.address, doctor1.address))
        .to.emit(healthRecords, "AccessRevoked");
      expect(await healthRecords.hasAccess(patient.address, doctor1.address)).to.equal(false);
    });

    it("Nobody else can use the relayer functions", async function () {
      await expect(healthRecords.connect(unauthorizedUser).registerRecordFor(patient.address, sampleHash2))
        .to.be.revertedWith("Only the MedLedger relayer");
      await expect(healthRecords.connect(doctor1).grantAccessFor(patient.address, doctor1.address))
        .to.be.revertedWith("Only the MedLedger relayer");
      await expect(healthRecords.connect(patient).revokeAccessFor(patient.address, doctor1.address))
        .to.be.revertedWith("Only the MedLedger relayer");
    });

    it("Relayer role can be handed over", async function () {
      await expect(healthRecords.connect(owner).setRelayer(doctor2.address))
        .to.emit(healthRecords, "RelayerChanged").withArgs(owner.address, doctor2.address);
      await expect(healthRecords.connect(owner).grantAccessFor(patient.address, doctor1.address))
        .to.be.revertedWith("Only the MedLedger relayer");
      await healthRecords.connect(doctor2).grantAccessFor(patient.address, doctor1.address);
      expect(await healthRecords.hasAccess(patient.address, doctor1.address)).to.equal(true);
    });
  });

  describe("6. Cost (Phase 10)", function () {
    it("Registering a record for a patient costs at most 60k gas", async function () {
      const receipt = await (await healthRecords.connect(owner).registerRecordFor(patient.address, sampleHash1)).wait();
      expect(receipt.gasUsed).to.be.lte(60000n);
    });
  });

  describe("7. Batches of records (Merkle root)", function () {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const leafOf = (who, h) => ethers.keccak256(ethers.keccak256(coder.encode(["address", "bytes32"], [who, h])));
    const pair = (a, b) => (BigInt(a) < BigInt(b) ? ethers.keccak256(ethers.concat([a, b])) : ethers.keccak256(ethers.concat([b, a])));
    function tree(leaves) {
      const levels = [leaves];
      while (levels[levels.length - 1].length > 1) {
        const cur = levels[levels.length - 1], next = [];
        for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? pair(cur[i], cur[i + 1]) : cur[i]);
        levels.push(next);
      }
      const proof = (i) => {
        const out = [];
        for (let l = 0; l < levels.length - 1; l++) {
          const sib = i ^ 1;
          if (sib < levels[l].length) out.push(levels[l][sib]);
          i = Math.floor(i / 2);
        }
        return out;
      };
      return { root: levels[levels.length - 1][0], proof };
    }
    const hashes = Array.from({ length: 5 }, (_, i) => ethers.keccak256(ethers.toUtf8Bytes(`batched-report-${i}`)));

    it("Relayer anchors a batch; each record is verified alone with its proof", async function () {
      const t = tree(hashes.map((h) => leafOf(patient.address, h)));
      await expect(healthRecords.connect(owner).anchorBatch(t.root, hashes.length)).to.emit(healthRecords, "BatchAnchored");
      for (let i = 0; i < hashes.length; i++) {
        expect(await healthRecords.verifyBatchedRecord(patient.address, hashes[i], t.root, t.proof(i))).to.equal(true);
      }
      const details = await healthRecords.getBatchDetails(t.root);
      expect(details.count).to.equal(5n);
      expect(details.timestamp).to.be.gt(0n);
    });

    it("A changed file, another patient or a wrong proof is refused", async function () {
      const t = tree(hashes.map((h) => leafOf(patient.address, h)));
      await healthRecords.connect(owner).anchorBatch(t.root, hashes.length);
      expect(await healthRecords.verifyBatchedRecord(patient.address, dummyHash, t.root, t.proof(0))).to.equal(false);
      expect(await healthRecords.verifyBatchedRecord(doctor1.address, hashes[0], t.root, t.proof(0))).to.equal(false);
      expect(await healthRecords.verifyBatchedRecord(patient.address, hashes[0], t.root, t.proof(1))).to.equal(false);
      expect(await healthRecords.verifyBatchedRecord(patient.address, hashes[0], dummyHash, t.proof(0))).to.equal(false);
    });

    it("Only the relayer anchors, and a root is anchored once", async function () {
      const t = tree(hashes.map((h) => leafOf(patient.address, h)));
      await expect(healthRecords.connect(patient).anchorBatch(t.root, 5)).to.be.revertedWith("Only the MedLedger relayer");
      await healthRecords.connect(owner).anchorBatch(t.root, 5);
      await expect(healthRecords.connect(owner).anchorBatch(t.root, 5)).to.be.revertedWith("Batch already anchored");
      await expect(healthRecords.connect(owner).anchorBatch(ethers.ZeroHash, 5)).to.be.revertedWith("Invalid batch root");
    });

    it("Anchoring 20 records costs at most 10k gas per record", async function () {
      const many = Array.from({ length: 20 }, (_, i) => leafOf(patient.address, ethers.keccak256(ethers.toUtf8Bytes(`r${i}`))));
      const receipt = await (await healthRecords.connect(owner).anchorBatch(tree(many).root, 20)).wait();
      expect(receipt.gasUsed / 20n).to.be.lte(10000n);
    });
  });
});
