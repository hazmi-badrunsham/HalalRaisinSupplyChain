// scripts/test-deployed-contract.js
const hre = require("hardhat");

async function main() {
  // Your deployed contract address
  const CONTRACT_ADDRESS = "0x95dF21cE4Fbb8eCf6916CA98315c77a191A1785c";
  
  console.log("🧪 Testing deployed contract at:", CONTRACT_ADDRESS);
  
  // Get your account
  const [account] = await hre.ethers.getSigners();
  console.log("Using account:", account.address);

  // Connect to the deployed contract
  const contract = await hre.ethers.getContractAt("HalalRaisinSupplyChain", CONTRACT_ADDRESS);
  
  console.log("\n📋 Initial contract state:");
  try {
    await contract.getBatch("RAISIN-TEST-001");
    console.log("- Test batch already exists (previous test)");
  } catch (error) {
    console.log("- No test batches yet (normal for fresh deployment)");
  }

  // Create a test batch - WAIT FOR TRANSACTION CONFIRMATION
  console.log("\n🍇 Creating test batch...");
  
  // Capture the transaction response
  const createTx = await contract.createBatch("RAISIN-TEST-001", "Sepolia Test Raisins");
  
  // Wait for transaction to be confirmed
  console.log("⏳ Waiting for transaction confirmation...");
  await createTx.wait(2); // Wait for 2 confirmations
  
  console.log("✅ Batch created successfully");

  // Now read the batch - it should exist after confirmation
  const batch = await contract.getBatch("RAISIN-TEST-001");
  console.log("\n🔍 Batch details after creation:");
  console.log("- Product:", batch[0]);
  console.log("- Batch ID:", batch[1]);
  console.log("- Status:", batch[4]);
  console.log("- Created at:", new Date(Number(batch[6]) * 1000).toLocaleString());

  // Add a new section to test halal certification
  console.log("\n🕌 Setting halal certificate...");
  const certTx = await contract.setHalalCertificate("RAISIN-TEST-001", "QmSepoliaTestCert123");
  await certTx.wait(2);
  
  // Get updated batch details
  const updatedBatch = await contract.getBatch("RAISIN-TEST-001");
  console.log("\n✅ Halal certificate set successfully!");
  console.log("- Updated status:", updatedBatch[4]);
  console.log("- Certificate hash:", updatedBatch[5]);

  console.log("\n🎉 All tests completed successfully!");
  console.log("🔗 View your contract on Sepolia Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });