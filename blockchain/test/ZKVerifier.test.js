const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZKVerifier Contract", function () {
  let zkVerifier;
  let admin, doctor, patient, attacker;

  const recordCommitment = ethers.keccak256(ethers.toUtf8Bytes("record-commitment-1234"));
  const authorizationCommitment = ethers.keccak256(ethers.toUtf8Bytes("auth-commitment-5678"));
  const requesterNullifier = ethers.keccak256(ethers.toUtf8Bytes("nullifier-9012"));

  // Mock Noir BN254 proof bytes with valid header
  const proofHeader = ethers.toUtf8Bytes("NOIR_PROOF_V1_BN254:");
  const proofPayload = ethers.randomBytes(32);
  const validProof = ethers.concat([proofHeader, proofPayload]);

  beforeEach(async function () {
    [admin, doctor, patient, attacker] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ZKVerifier");
    zkVerifier = await Factory.deploy(admin.address);
    await zkVerifier.waitForDeployment();
  });

  it("should deploy with admin assigned DEFAULT_ADMIN_ROLE and VERIFIER_ADMIN_ROLE", async function () {
    const DEFAULT_ADMIN_ROLE = await zkVerifier.DEFAULT_ADMIN_ROLE();
    const VERIFIER_ADMIN_ROLE = await zkVerifier.VERIFIER_ADMIN_ROLE();

    expect(await zkVerifier.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    expect(await zkVerifier.hasRole(VERIFIER_ADMIN_ROLE, admin.address)).to.be.true;
  });

  it("should verify a valid Zero-Knowledge authorization proof and emit event", async function () {
    await expect(
      zkVerifier.connect(doctor).verifyAuthorizationProof(
        validProof,
        recordCommitment,
        authorizationCommitment,
        requesterNullifier
      )
    )
      .to.emit(zkVerifier, "ProofVerified")
      .withArgs(
        requesterNullifier,
        recordCommitment,
        authorizationCommitment,
        (ts) => ts > 0
      );

    expect(await zkVerifier.isNullifierUsed(requesterNullifier)).to.be.true;
    const timestamp = await zkVerifier.getNullifierTimestamp(requesterNullifier);
    expect(timestamp).to.be.gt(0);
  });

  it("should reject double-spending / replaying the same nullifier", async function () {
    await zkVerifier.connect(doctor).verifyAuthorizationProof(
      validProof,
      recordCommitment,
      authorizationCommitment,
      requesterNullifier
    );

    // Second submission with the same nullifier must fail
    await expect(
      zkVerifier.connect(doctor).verifyAuthorizationProof(
        validProof,
        recordCommitment,
        authorizationCommitment,
        requesterNullifier
      )
    ).to.be.revertedWithCustomError(zkVerifier, "NullifierAlreadyUsed");
  });

  it("should reject empty proof or zero commitments", async function () {
    await expect(
      zkVerifier.connect(doctor).verifyAuthorizationProof(
        "0x",
        recordCommitment,
        authorizationCommitment,
        requesterNullifier
      )
    ).to.be.revertedWithCustomError(zkVerifier, "InvalidProofData");

    await expect(
      zkVerifier.connect(doctor).verifyAuthorizationProof(
        validProof,
        ethers.ZeroHash,
        authorizationCommitment,
        requesterNullifier
      )
    ).to.be.revertedWithCustomError(zkVerifier, "InvalidCommitment");
  });
});
