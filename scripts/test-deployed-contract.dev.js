// scripts/test-deployed-contract.dev.js
const hre = require("hardhat");

async function main() {
  const CONTRACT_ADDRESS = "0x95dF21cE4Fbb8eCf6916CA98315c77a191A1785c";
  const CONFIRMATIONS = 2;

  console.log("🧪 DEV MODE TEST – HalalRaisinSupplyChain");
  console.log("📍 Contract:", CONTRACT_ADDRESS);

  const [admin] = await hre.ethers.getSigners();
  console.log("👤 Using account:", admin.address);

  const contract = await hre.ethers.getContractAt(
    "HalalRaisinSupplyChain",
    CONTRACT_ADDRESS,
    admin
  );

  // ===== ASSIGN HALAL AUTHORITY ROLE (DEV MODE) =====
  console.log("\n🔐 Assigning HALAL_AUTHORITY_ROLE...");
  const roleTx = await contract.assignHalalAuthority(admin.address, {
    gasLimit: 100_000,
  });
  await roleTx.wait(CONFIRMATIONS);
  console.log("✅ Halal authority role assigned");

  // ===== UNIQUE BATCH =====
  const batchId = `RAISIN-DEV-${Date.now()}`;
  const productName = "Dev Mode Sepolia Raisins";
  const certHash = "QmDevModeHalalCert123";

  console.log("\n🆔 Batch ID:", batchId);

  // ===== CREATE BATCH =====
  console.log("\n🍇 Creating batch...");
  const createTx = await contract.createBatch(batchId, productName, {
    gasLimit: 300_000,
  });
  await createTx.wait(CONFIRMATIONS);
  console.log("✅ Batch created");

  // ===== READ =====
  const batch = await contract.getBatch(batchId);
  console.log("\n📦 Batch Info:");
  console.log("  - Status:", batch[4]);

  // ===== SET HALAL CERT =====
  console.log("\n🕌 Setting halal certificate...");
  const certTx = await contract.setHalalCertificate(batchId, certHash, {
    gasLimit: 200_000,
  });
  await certTx.wait(CONFIRMATIONS);
  console.log("✅ Halal certificate set");

  // ===== FINAL =====
  const updated = await contract.getBatch(batchId);
  console.log("\n🎉 FINAL STATE:");
  console.log("  - Status    :", updated[4]);
  console.log("  - Cert Hash:", updated[5]);

  console.log("\n🔗 Sepolia Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`);

  console.log("\n✅ DEV MODE TEST PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  });
