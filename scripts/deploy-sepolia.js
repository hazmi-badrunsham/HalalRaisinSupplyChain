// scripts/deploy-sepolia.js
const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying HalalRaisinSupplyChain to Sepolia...");

  // Get accounts
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy contract
  const HalalRaisinSupplyChain = await hre.ethers.getContractFactory("HalalRaisinSupplyChain");
  const contract = await HalalRaisinSupplyChain.deploy();
  
  await contract.waitForDeployment();
  console.log("✅ Contract deployed to:", await contract.getAddress());

  // Verify on Etherscan (if API key configured)
  try {
    await contract.deploymentTransaction().wait(5); // Wait for 5 confirmations
    await hre.run("verify:verify", {
      address: await contract.getAddress(),
    });
    console.log("✅ Contract verified on Etherscan!");
  } catch (error) {
    console.log("⚠️ Verification failed, contract still deployed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment error:", error);
    process.exit(1);
  });