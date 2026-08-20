const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ConsentManager Contract", function () {
  let consentManager;
  let patient, doctor, otherDoctor;

  const recordId = ethers.keccak256(ethers.toUtf8Bytes("record-uuid-1234-5678"));
  const VIEW_RECORD = 1;
  const VIEW_DOCUMENT = 2;
  const VIEW_FHIR = 4;
  const FULL_ACCESS = 15;

  beforeEach(async function () {
    [patient, doctor, otherDoctor] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ConsentManager");
    consentManager = await Factory.deploy();
    await consentManager.waitForDeployment();
  });

  it("should allow a patient to grant time-bounded granular consent", async function () {
    const latestTime = await time.latest();
    const expiresAt = latestTime + 86400; // 24 hours

    const consentId = await consentManager.computeConsentId(patient.address, recordId, doctor.address);

    await expect(
      consentManager.connect(patient).grantConsent(recordId, doctor.address, VIEW_RECORD | VIEW_DOCUMENT, expiresAt)
    )
      .to.emit(consentManager, "ConsentGranted")
      .withArgs(
        patient.address,
        recordId,
        doctor.address,
        VIEW_RECORD | VIEW_DOCUMENT,
        expiresAt,
        consentId,
        (ts) => ts > 0
      );

    const consent = await consentManager.getConsent(patient.address, recordId, doctor.address);
    expect(consent.patient).to.equal(patient.address);
    expect(consent.grantee).to.equal(doctor.address);
    expect(consent.permissions).to.equal(VIEW_RECORD | VIEW_DOCUMENT);
    expect(consent.expiresAt).to.equal(expiresAt);
    expect(consent.active).to.be.true;
  });

  it("should validate granular permissions correctly", async function () {
    const latestTime = await time.latest();
    const expiresAt = latestTime + 86400;

    await consentManager.connect(patient).grantConsent(
      recordId,
      doctor.address,
      VIEW_RECORD | VIEW_DOCUMENT,
      expiresAt
    );

    // Granted permissions should return true
    expect(
      await consentManager.isConsentValid(patient.address, recordId, doctor.address, VIEW_RECORD)
    ).to.be.true;
    expect(
      await consentManager.isConsentValid(patient.address, recordId, doctor.address, VIEW_DOCUMENT)
    ).to.be.true;

    // Ungranted permission (VIEW_FHIR = 4) should return false
    expect(
      await consentManager.isConsentValid(patient.address, recordId, doctor.address, VIEW_FHIR)
    ).to.be.false;

    // Unrelated doctor should return false
    expect(
      await consentManager.isConsentValid(patient.address, recordId, otherDoctor.address, VIEW_RECORD)
    ).to.be.false;
  });

  it("should automatically expire consent after expiration timestamp", async function () {
    const latestTime = await time.latest();
    const expiresAt = latestTime + 3600; // 1 hour

    await consentManager.connect(patient).grantConsent(
      recordId,
      doctor.address,
      FULL_ACCESS,
      expiresAt
    );

    expect(
      await consentManager.isConsentValid(patient.address, recordId, doctor.address, VIEW_RECORD)
    ).to.be.true;

    // Fast-forward time past expiration
    await time.increase(3601);

    expect(
      await consentManager.isConsentValid(patient.address, recordId, doctor.address, VIEW_RECORD)
    ).to.be.false;
  });

  it("should allow patient to revoke active consent immediately", async function () {
    const latestTime = await time.latest();
    const expiresAt = latestTime + 86400;

    await consentManager.connect(patient).grantConsent(
      recordId,
      doctor.address,
      FULL_ACCESS,
      expiresAt
    );

    const consentId = await consentManager.computeConsentId(patient.address, recordId, doctor.address);

    await expect(consentManager.connect(patient).revokeConsent(recordId, doctor.address))
      .to.emit(consentManager, "ConsentRevoked")
      .withArgs(patient.address, recordId, doctor.address, consentId, (ts) => ts > 0);

    expect(
      await consentManager.isConsentValid(patient.address, recordId, doctor.address, VIEW_RECORD)
    ).to.be.false;
  });

  it("should reject unauthorized caller from revoking patient consent", async function () {
    const latestTime = await time.latest();
    const expiresAt = latestTime + 86400;

    await consentManager.connect(patient).grantConsent(
      recordId,
      doctor.address,
      FULL_ACCESS,
      expiresAt
    );

    // otherDoctor attempts to revoke patient's consent
    await expect(
      consentManager.connect(otherDoctor).revokeConsent(recordId, doctor.address)
    ).to.be.revertedWithCustomError(consentManager, "ConsentNotFound");
  });
});
