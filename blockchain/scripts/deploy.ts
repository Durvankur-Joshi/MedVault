import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("==========================================");
  console.log("MedVault Smart Contract Deployment");
  console.log("==========================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // 1. Deploy IdentityRegistry
  console.log("\n1. Deploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy(deployer.address);
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", identityRegistryAddress);

  // 2. Deploy MedicalRecordRegistry
  console.log("\n2. Deploying MedicalRecordRegistry...");
  const MedicalRecordRegistry = await ethers.getContractFactory("MedicalRecordRegistry");
  const medicalRecordRegistry = await MedicalRecordRegistry.deploy(deployer.address);
  await medicalRecordRegistry.waitForDeployment();
  const medicalRecordRegistryAddress = await medicalRecordRegistry.getAddress();
  console.log("MedicalRecordRegistry deployed to:", medicalRecordRegistryAddress);

  // 3. Deploy ConsentManager
  console.log("\n3. Deploying ConsentManager...");
  const ConsentManager = await ethers.getContractFactory("ConsentManager");
  const consentManager = await ConsentManager.deploy();
  await consentManager.waitForDeployment();
  const consentManagerAddress = await consentManager.getAddress();
  console.log("ConsentManager deployed to:", consentManagerAddress);

  // 4. Deploy UltraVerifier (Cryptographic Noir Verifier)
  console.log("\n4. Deploying UltraVerifier...");
  const UltraVerifier = await ethers.getContractFactory("UltraVerifier");
  const ultraVerifier = await UltraVerifier.deploy();
  await ultraVerifier.waitForDeployment();
  const ultraVerifierAddress = await ultraVerifier.getAddress();
  console.log("UltraVerifier deployed to:", ultraVerifierAddress);

  // 5. Deploy ZKVerifier
  console.log("\n5. Deploying ZKVerifier...");
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy(deployer.address, ultraVerifierAddress);
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("ZKVerifier deployed to:", zkVerifierAddress);

  // Save deployed addresses and ABIs for backend & frontend
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      IdentityRegistry: identityRegistryAddress,
      MedicalRecordRegistry: medicalRecordRegistryAddress,
      ConsentManager: consentManagerAddress,
      UltraVerifier: ultraVerifierAddress,
      ZKVerifier: zkVerifierAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deployedPath = path.join(deploymentsDir, "deployed_addresses.json");
  fs.writeFileSync(deployedPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deployedPath);
  console.log("==========================================");

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
