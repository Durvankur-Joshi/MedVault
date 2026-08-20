const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityRegistry Contract", function () {
  let identityRegistry;
  let admin, patient, doctor, unauthorized;
  let PATIENT_ROLE, DOCTOR_ROLE;

  beforeEach(async function () {
    [admin, patient, doctor, unauthorized] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await Factory.deploy(admin.address);
    await identityRegistry.waitForDeployment();

    PATIENT_ROLE = await identityRegistry.PATIENT_ROLE();
    DOCTOR_ROLE = await identityRegistry.DOCTOR_ROLE();
  });

  it("should deploy with admin assigned DEFAULT_ADMIN_ROLE", async function () {
    const DEFAULT_ADMIN = await identityRegistry.DEFAULT_ADMIN_ROLE();
    expect(await identityRegistry.hasRole(DEFAULT_ADMIN, admin.address)).to.be.true;
  });

  it("should allow admin to register a patient identity", async function () {
    await expect(identityRegistry.connect(admin).registerIdentity(patient.address, PATIENT_ROLE))
      .to.emit(identityRegistry, "IdentityRegistered")
      .withArgs(patient.address, PATIENT_ROLE, (ts) => ts > 0);

    const identity = await identityRegistry.getIdentity(patient.address);
    expect(identity.role).to.equal(PATIENT_ROLE);
    expect(identity.isActive).to.be.true;
    expect(await identityRegistry.isIdentityActive(patient.address, PATIENT_ROLE)).to.be.true;
  });

  it("should prevent duplicate identity registration", async function () {
    await identityRegistry.connect(admin).registerIdentity(doctor.address, DOCTOR_ROLE);
    await expect(
      identityRegistry.connect(admin).registerIdentity(doctor.address, DOCTOR_ROLE)
    ).to.be.revertedWithCustomError(identityRegistry, "IdentityAlreadyExists");
  });

  it("should reject non-admin from registering identities", async function () {
    await expect(
      identityRegistry.connect(unauthorized).registerIdentity(patient.address, PATIENT_ROLE)
    ).to.be.revertedWithCustomError(identityRegistry, "AccessControlUnauthorizedAccount");
  });

  it("should toggle identity status and revoke role when deactivated", async function () {
    await identityRegistry.connect(admin).registerIdentity(doctor.address, DOCTOR_ROLE);
    expect(await identityRegistry.hasRole(DOCTOR_ROLE, doctor.address)).to.be.true;

    // Deactivate
    await identityRegistry.connect(admin).setIdentityStatus(doctor.address, false);
    expect(await identityRegistry.isIdentityActive(doctor.address, DOCTOR_ROLE)).to.be.false;
    expect(await identityRegistry.hasRole(DOCTOR_ROLE, doctor.address)).to.be.false;

    // Reactivate
    await identityRegistry.connect(admin).setIdentityStatus(doctor.address, true);
    expect(await identityRegistry.isIdentityActive(doctor.address, DOCTOR_ROLE)).to.be.true;
    expect(await identityRegistry.hasRole(DOCTOR_ROLE, doctor.address)).to.be.true;
  });
});
