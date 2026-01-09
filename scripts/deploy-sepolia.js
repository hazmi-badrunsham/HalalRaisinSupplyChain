const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying HalalRaisinSupplyChainV2 to Sepolia...");

  // Get accounts
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy contract - Use the correct contract name
  const HalalRaisinSupplyChainV2 = await hre.ethers.getContractFactory("HalalRaisinSupplyChainV2");
  const contract = await HalalRaisinSupplyChainV2.deploy();
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log("✅ Contract deployed to:", contractAddress);

  // Save contract address to a file for frontend
  const fs = require("fs");
  fs.writeFileSync("./deployed-address.txt", contractAddress);
  console.log("✅ Contract address saved to deployed-address.txt");

  // Verify on Etherscan
  console.log("\n⏳ Waiting for transaction confirmations...");
  await contract.deploymentTransaction().wait(5); // Wait for 5 confirmations
  
  try {
    console.log("🔍 Verifying contract on Etherscan...");
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("✅ Contract verified on Etherscan!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified!");
    } else {
      console.log("⚠️ Verification failed:", error.message);
      console.log("You can verify manually with:");
      console.log(`npx hardhat verify --network sepolia ${contractAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment error:", error);
    process.exit(1);
  });