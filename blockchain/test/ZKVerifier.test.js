const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZKVerifier & UltraVerifier Contracts", function () {
  let ultraVerifier;
  let zkVerifier;
  let admin, doctor, patient, attacker;

  // BN254 field elements (must be < R_MOD)
  const recordCommitment = ethers.keccak256(ethers.toUtf8Bytes("record-commitment-1234"));
  const authorizationCommitment = ethers.keccak256(ethers.toUtf8Bytes("auth-commitment-5678"));
  const requesterNullifier = ethers.keccak256(ethers.toUtf8Bytes("nullifier-9012"));

  function buildValidProof(recCommit, authCommit, nullifier) {
    const proofHeader = ethers.toUtf8Bytes("NOIR_PROOF_V1_BN254:");
    const expectedEvaluation = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes("NOIR_BN254_CIRCUIT_EVALUATION:"),
        recCommit,
        authCommit,
        nullifier,
      ])
    );
    const trailingEvaluations = ethers.randomBytes(32);
    return ethers.concat([proofHeader, ethers.getBytes(expectedEvaluation), trailingEvaluations]);
  }

  beforeEach(async function () {
    [admin, doctor, patient, attacker] = await ethers.getSigners();

    const UltraVerifierFactory = await ethers.getContractFactory("UltraVerifier");
    ultraVerifier = await UltraVerifierFactory.deploy();
    await ultraVerifier.waitForDeployment();

    const ZKVerifierFactory = await ethers.getContractFactory("ZKVerifier");
    zkVerifier = await ZKVerifierFactory.deploy(admin.address, await ultraVerifier.getAddress());
    await zkVerifier.waitForDeployment();
  });

  it("should deploy with admin assigned DEFAULT_ADMIN_ROLE and VERIFIER_ADMIN_ROLE", async function () {
    const DEFAULT_ADMIN_ROLE = await zkVerifier.DEFAULT_ADMIN_ROLE();
    const VERIFIER_ADMIN_ROLE = await zkVerifier.VERIFIER_ADMIN_ROLE();

    expect(await zkVerifier.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    expect(await zkVerifier.hasRole(VERIFIER_ADMIN_ROLE, admin.address)).to.be.true;
    expect(await zkVerifier.ultraVerifier()).to.equal(await ultraVerifier.getAddress());
  });

  it("should verify a valid Zero-Knowledge authorization proof and emit event", async function () {
    const validProof = buildValidProof(recordCommitment, authorizationCommitment, requesterNullifier);

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

  it("should reject tampered cryptographic proof bytes", async function () {
    // Generate proof for different inputs -> cryptographic mismatch
    const wrongProof = buildValidProof(
      ethers.keccak256(ethers.toUtf8Bytes("other-rec")),
      authorizationCommitment,
      requesterNullifier
    );

    await expect(
      zkVerifier.connect(doctor).verifyAuthorizationProof(
        wrongProof,
        recordCommitment,
        authorizationCommitment,
        requesterNullifier
      )
    ).to.be.revertedWithCustomError(zkVerifier, "CryptographicVerificationFailed");
  });

  it("should reject tampered public inputs", async function () {
    const validProof = buildValidProof(recordCommitment, authorizationCommitment, requesterNullifier);
    const tamperedRecordCommitment = ethers.keccak256(ethers.toUtf8Bytes("tampered-record"));

    await expect(
      zkVerifier.connect(doctor).verifyAuthorizationProof(
        validProof,
        tamperedRecordCommitment,
        authorizationCommitment,
        requesterNullifier
      )
    ).to.be.revertedWithCustomError(zkVerifier, "CryptographicVerificationFailed");
  });

  it("should reject double-spending / replaying the same nullifier", async function () {
    const validProof = buildValidProof(recordCommitment, authorizationCommitment, requesterNullifier);

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
    const validProof = buildValidProof(recordCommitment, authorizationCommitment, requesterNullifier);

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

  it("should allow verifier admin to update UltraVerifier contract", async function () {
    const newUltraVerifier = await (await ethers.getContractFactory("UltraVerifier")).deploy();
    await newUltraVerifier.waitForDeployment();

    await expect(zkVerifier.connect(admin).setUltraVerifier(await newUltraVerifier.getAddress()))
      .to.emit(zkVerifier, "UltraVerifierUpdated")
      .withArgs(await newUltraVerifier.getAddress());

    expect(await zkVerifier.ultraVerifier()).to.equal(await newUltraVerifier.getAddress());
  });

  it("should reject non-admin from updating UltraVerifier contract", async function () {
    const newUltraVerifier = await (await ethers.getContractFactory("UltraVerifier")).deploy();
    await newUltraVerifier.waitForDeployment();

    await expect(
      zkVerifier.connect(attacker).setUltraVerifier(await newUltraVerifier.getAddress())
    ).to.be.revertedWithCustomError(zkVerifier, "AccessControlUnauthorizedAccount");
  });
});

