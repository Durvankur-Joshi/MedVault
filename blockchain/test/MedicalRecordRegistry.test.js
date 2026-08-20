const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedicalRecordRegistry Contract", function () {
  let recordRegistry;
  let admin, patient, doctor, attacker;

  const recordId = ethers.keccak256(ethers.toUtf8Bytes("record-uuid-1234-5678"));
  const recordHash = ethers.keccak256(ethers.toUtf8Bytes("canonical-fhir-observation-sha256-hash"));
  const patientCommitment = ethers.keccak256(ethers.toUtf8Bytes("patient-secret-commitment-4321"));
  const storageCommitment = ethers.keccak256(ethers.toUtf8Bytes("local://45128ea5-dc22.enc"));

  beforeEach(async function () {
    [admin, patient, doctor, attacker] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("MedicalRecordRegistry");
    recordRegistry = await Factory.deploy(admin.address);
    await recordRegistry.waitForDeployment();
  });

  it("should allow anchoring a new medical record integrity commitment", async function () {
    await expect(
      recordRegistry.connect(patient).registerRecord(
        recordId,
        recordHash,
        patientCommitment,
        storageCommitment
      )
    )
      .to.emit(recordRegistry, "RecordRegistered")
      .withArgs(
        recordId,
        recordHash,
        patientCommitment,
        storageCommitment,
        patient.address,
        (ts) => ts > 0
      );

    const rec = await recordRegistry.getRecord(recordId);
    expect(rec.recordHash).to.equal(recordHash);
    expect(rec.patientCommitment).to.equal(patientCommitment);
    expect(rec.storageCommitment).to.equal(storageCommitment);
    expect(rec.anchoredBy).to.equal(patient.address);
    expect(rec.active).to.be.true;
  });

  it("should verify matching hash correctly", async function () {
    await recordRegistry.connect(patient).registerRecord(
      recordId,
      recordHash,
      patientCommitment,
      storageCommitment
    );

    const [isValid, ts] = await recordRegistry.verifyRecord(recordId, recordHash);
    expect(isValid).to.be.true;
    expect(ts).to.be.greaterThan(0);
  });

  it("should fail verification when hash is modified/tampered", async function () {
    await recordRegistry.connect(patient).registerRecord(
      recordId,
      recordHash,
      patientCommitment,
      storageCommitment
    );

    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-data-hash"));
    const [isValid] = await recordRegistry.verifyRecord(recordId, wrongHash);
    expect(isValid).to.be.false;
  });

  it("should prevent duplicate record registration", async function () {
    await recordRegistry.connect(patient).registerRecord(
      recordId,
      recordHash,
      patientCommitment,
      storageCommitment
    );

    await expect(
      recordRegistry.connect(patient).registerRecord(
        recordId,
        recordHash,
        patientCommitment,
        storageCommitment
      )
    ).to.be.revertedWithCustomError(recordRegistry, "RecordAlreadyExists");
  });

  it("should allow anchorer to revoke record", async function () {
    await recordRegistry.connect(patient).registerRecord(
      recordId,
      recordHash,
      patientCommitment,
      storageCommitment
    );

    await expect(recordRegistry.connect(patient).revokeRecord(recordId))
      .to.emit(recordRegistry, "RecordRevoked")
      .withArgs(recordId, patient.address, (ts) => ts > 0);

    const [isValid] = await recordRegistry.verifyRecord(recordId, recordHash);
    expect(isValid).to.be.false;
  });

  it("should reject unauthorized caller from revoking record", async function () {
    await recordRegistry.connect(patient).registerRecord(
      recordId,
      recordHash,
      patientCommitment,
      storageCommitment
    );

    await expect(
      recordRegistry.connect(attacker).revokeRecord(recordId)
    ).to.be.revertedWithCustomError(recordRegistry, "UnauthorizedCaller");
  });
});
