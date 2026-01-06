// services/blockchain.js
import { ethers } from "ethers";
import { HALAL_ABI } from "../abi/halalABI";

export const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/203linwjgJOZpUIWdMD-i";
export const CONTRACT_ADDRESS = "0x95dF21cE4Fbb8eCf6916CA98315c77a191A1785c";

// Read-only provider (for querying)
const provider = new ethers.JsonRpcProvider(RPC_URL);
export const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, HALAL_ABI, provider);

// Function to get contract with signer (for write operations)
export function getContractWithSigner(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, HALAL_ABI, signer);
}

// Existing read function (unchanged)
export async function verifyBatch(batchId) {
  const exists = await readOnlyContract.batchExists(batchId);
  if (!exists) {
    throw new Error("Batch not found");
  }

  const batch = await readOnlyContract.getBatch(batchId);

  return {
    productName: batch[0],
    batchId: batch[1],
    producer: batch[2],
    currentOwner: batch[3],
    status: batch[4],
    certHash: batch[5],
    createdAt: new Date(Number(batch[6]) * 1000).toLocaleString(),
  };
}