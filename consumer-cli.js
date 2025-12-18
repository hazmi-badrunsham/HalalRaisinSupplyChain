// consumer-cli.js
// FIXED – ethers v6 compatible with proper ABI and clean RPC URL

const { ethers } = require("ethers");
const readline = require("readline");

// ===== CONFIG =====
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/203linwjgJOZpUIWdMD-i"; // FIXED: removed trailing spaces
const CONTRACT_ADDRESS = "0x95dF21cE4Fbb8eCf6916CA98315c77a191A1785c";

// FIXED ABI: Proper function signature matching the contract's return values
const ABI = [
  "function getBatch(string memory batchId) view returns (string memory productName, string memory batchId, address producer, address currentOwner, string memory status, string memory halalCertHash, uint256 createdAt)"
];

// SETUP
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("🔍 Enter Batch ID: ", async (input) => {
  const batchId = input.trim();
  
  console.log(`\n🔍 Checking blockchain for Batch ID: ${batchId}`);
  
  try {
    // Check if batch exists first
    const batchExists = await contract.batchExists(batchId);
    if (!batchExists) {
      console.error("\n❌ Batch not found on the blockchain");
      console.error(`🔍 Searched for Batch ID: ${batchId}`);
      console.error("💡 Tip: Verify the Batch ID matches exactly what was created in your test script");
      rl.close();
      return;
    }
    
    // Get batch details
    const batch = await contract.getBatch(batchId);

    console.log("\n✅ HALAL VERIFICATION SUCCESSFUL");
    console.log("==================================");
    console.log(`Product Name   : ${batch.productName}`);
    console.log(`Batch ID       : ${batch.batchId}`);
    console.log(`Producer       : ${batch.producer}`);
    console.log(`Current Owner  : ${batch.currentOwner}`);
    console.log(`Status         : ${batch.status}`);
    console.log(`Halal Cert Hash: ${batch.halalCertHash || "(not certified)"}`);
    console.log(`Created At     : ${new Date(Number(batch.createdAt) * 1000).toLocaleString()}`);
    console.log("==================================\n");
    console.log("🔗 View on Sepolia Etherscan: https://sepolia.etherscan.io/address/" + CONTRACT_ADDRESS);
    
  } catch (err) {
    console.error("\n❌ Verification Failed");
    console.error("ERROR DETAILS:");
    console.error(`- Message: ${err.message}`);
    console.error(`- Code   : ${err.code}`);
    
    // Show user-friendly error based on common issues
    if (err.message.includes("invalid address") || err.message.includes("ENS name")) {
      console.error("\n💡 Possible issue: Invalid contract address");
      console.error(`Contract address used: ${CONTRACT_ADDRESS}`);
    } else if (err.message.includes("invalid URL")) {
      console.error("\n💡 Possible issue: Invalid RPC URL");
      console.error("Check your Alchemy API key and URL format");
    } else if (err.message.includes("network")) {
      console.error("\n💡 Possible issue: Network connection problem");
      console.error("Check your internet connection");
    } else {
      console.error("\n💡 DEBUG INFO:");
      console.error(`- Contract: ${CONTRACT_ADDRESS}`);
      console.error(`- RPC URL  : ${RPC_URL.substring(0, 40)}...`); // Show partial URL for security
      console.error(`- Batch ID : "${batchId}"`);
    }
  } finally {
    rl.close();
  }
});