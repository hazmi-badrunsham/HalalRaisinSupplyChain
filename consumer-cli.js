// consumer-cli.js
// FINAL FIX – ethers v6 compatible

const { ethers } = require("ethers");
const readline = require("readline");

// ===== CONFIG =====
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/203linwjgJOZpUIWdMD-i";
const CONTRACT_ADDRESS = "0x95dF21cE4Fbb8eCf6916CA98315c77a191A1785c";

// ABI
const ABI = [
  "function getBatch(string batchId) view returns (tuple(string,string,address,address,string,string,uint256))"
];

// SETUP
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("🔍 Enter Batch ID: ", async (batchId) => {
  try {
    const batch = await contract.getBatch(batchId.trim());

    console.log("\n📦 Halal Verification Result");
    console.log("--------------------------------");
    console.log("Product Name   :", batch[0]);
    console.log("Batch ID       :", batch[1]);
    console.log("Producer       :", batch[2]);
    console.log("Current Owner  :", batch[3]);
    console.log("Status         :", batch[4]);
    console.log("Halal Cert Hash:", batch[5]);
    console.log(
      "Created At     :",
      new Date(Number(batch[6]) * 1000).toLocaleString()
    );
    console.log("--------------------------------");

  } catch (err) {
    console.error("❌ Batch not found or invalid Batch ID");
    console.error("DEBUG:", err.message);
  } finally {
    rl.close();
  }
});
