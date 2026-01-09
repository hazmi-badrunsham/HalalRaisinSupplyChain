// services/blockchain.js
import { ethers } from "ethers";
import { HALAL_ABI } from "../abi/halalABI";

export const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/203linwjgJOZpUIWdMD-i";
// TODO: Update this with your new contract address after deployment
export const CONTRACT_ADDRESS = "0x47B4Feb9DA3827C81AC7d37aa98818481d2fD97B"; // REPLACE WITH NEW ADDRESS

// Read-only provider (for querying)
const provider = new ethers.JsonRpcProvider(RPC_URL);
export const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, HALAL_ABI, provider);

// Function to get contract with signer (for write operations)
export function getContractWithSigner(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, HALAL_ABI, signer);
}

// ============= BATCH VERIFICATION FUNCTIONS =============

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

// ============= NEW BATCH QUERY FUNCTIONS =============

/**
 * Get all batches created by a specific address
 * @param {string} creatorAddress - Address of the creator
 * @returns {Promise<Array>} Array of batch objects
 */
export async function getBatchesByCreator(creatorAddress) {
  try {
    const batchIds = await readOnlyContract.getBatchesByCreator(creatorAddress);
    
    if (batchIds.length === 0) {
      return [];
    }

    // Fetch detailed information for each batch
    const batches = await Promise.all(
      batchIds.map(async (batchId) => {
        try {
          const batchData = await readOnlyContract.getBatch(batchId);
          return {
            id: batchId,
            productName: batchData[0],
            batchId: batchData[1],
            producer: batchData[2],
            currentOwner: batchData[3],
            status: batchData[4],
            certHash: batchData[5],
            createdAt: new Date(Number(batchData[6]) * 1000),
            timestamp: new Date(Number(batchData[6]) * 1000).toLocaleString(),
          };
        } catch (err) {
          console.warn(`Failed to fetch details for batch ${batchId}:`, err);
          return null;
        }
      })
    );

    // Filter out null results and sort by creation date (newest first)
    return batches
      .filter(batch => batch !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Error fetching batches by creator:", error);
    throw new Error(`Failed to fetch batches: ${error.message}`);
  }
}

/**
 * Get all batches owned by a specific address
 * @param {string} ownerAddress - Address of the current owner
 * @returns {Promise<Array>} Array of batch objects
 */
export async function getBatchesByOwner(ownerAddress) {
  try {
    const batchIds = await readOnlyContract.getBatchesByOwner(ownerAddress);
    
    if (batchIds.length === 0) {
      return [];
    }

    // Fetch detailed information for each batch
    const batches = await Promise.all(
      batchIds.map(async (batchId) => {
        try {
          const batchData = await readOnlyContract.getBatch(batchId);
          return {
            id: batchId,
            productName: batchData[0],
            batchId: batchData[1],
            producer: batchData[2],
            currentOwner: batchData[3],
            status: batchData[4],
            certHash: batchData[5],
            createdAt: new Date(Number(batchData[6]) * 1000),
            timestamp: new Date(Number(batchData[6]) * 1000).toLocaleString(),
          };
        } catch (err) {
          console.warn(`Failed to fetch details for batch ${batchId}:`, err);
          return null;
        }
      })
    );

    // Filter out null results and sort by creation date (newest first)
    return batches
      .filter(batch => batch !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Error fetching batches by owner:", error);
    throw new Error(`Failed to fetch batches: ${error.message}`);
  }
}

/**
 * Get total number of batches
 * @returns {Promise<number>} Total batch count
 */
export async function getTotalBatchCount() {
  try {
    return await readOnlyContract.getTotalBatchCount();
  } catch (error) {
    console.error("Error fetching total batch count:", error);
    return 0;
  }
}

/**
 * Get multiple batches in one call (optimized)
 * @param {Array<string>} batchIds - Array of batch IDs
 * @returns {Promise<Array>} Array of batch objects
 */
export async function getMultipleBatches(batchIds) {
  try {
    if (!batchIds || batchIds.length === 0) {
      return [];
    }

    const batchData = await readOnlyContract.getMultipleBatches(batchIds);
    
    const [
      productNames,
      batchIdsResult,
      producersArr,
      currentOwners,
      statuses,
      certHashes,
      createdAts
    ] = batchData;

    // Transform the data into a more usable format
    return batchIds.map((_, index) => ({
      id: batchIdsResult[index],
      productName: productNames[index],
      batchId: batchIdsResult[index],
      producer: producersArr[index],
      currentOwner: currentOwners[index],
      status: statuses[index],
      certHash: certHashes[index],
      createdAt: new Date(Number(createdAts[index]) * 1000),
      timestamp: new Date(Number(createdAts[index]) * 1000).toLocaleString(),
    }));
  } catch (error) {
    console.error("Error fetching multiple batches:", error);
    
    // Fallback to individual calls if the batch function fails
    console.log("Falling back to individual batch calls...");
    const batches = await Promise.all(
      batchIds.map(async (batchId) => {
        try {
          const batch = await readOnlyContract.getBatch(batchId);
          return {
            id: batchId,
            productName: batch[0],
            batchId: batch[1],
            producer: batch[2],
            currentOwner: batch[3],
            status: batch[4],
            certHash: batch[5],
            createdAt: new Date(Number(batch[6]) * 1000),
            timestamp: new Date(Number(batch[6]) * 1000).toLocaleString(),
          };
        } catch (err) {
          console.warn(`Failed to fetch batch ${batchId}:`, err);
          return null;
        }
      })
    );

    return batches.filter(batch => batch !== null);
  }
}

/**
 * Check if an address has a specific role
 * @param {string} address - Address to check
 * @param {string} role - Role to check (PRODUCER_ROLE, DISTRIBUTOR_ROLE, etc.)
 * @returns {Promise<boolean>} True if address has the role
 */
export async function hasRole(address, role) {
  try {
    const roleHash = {
      PRODUCER_ROLE: await readOnlyContract.PRODUCER_ROLE(),
      DISTRIBUTOR_ROLE: await readOnlyContract.DISTRIBUTOR_ROLE(),
      RETAILER_ROLE: await readOnlyContract.RETAILER_ROLE(),
      HALAL_AUTHORITY_ROLE: await readOnlyContract.HALAL_AUTHORITY_ROLE(),
      DEFAULT_ADMIN_ROLE: await readOnlyContract.DEFAULT_ADMIN_ROLE(),
    }[role];

    if (!roleHash) {
      throw new Error(`Invalid role: ${role}`);
    }

    return await readOnlyContract.hasRole(roleHash, address);
  } catch (error) {
    console.error(`Error checking role ${role} for address ${address}:`, error);
    return false;
  }
}

/**
 * Get all batches with pagination
 * @param {number} start - Starting index
 * @param {number} limit - Number of batches to return
 * @returns {Promise<Array>} Array of batch IDs
 */
export async function getAllBatchIds(start = 0, limit = 50) {
  try {
    const batchIds = await readOnlyContract.getAllBatchIds(start, limit);
    return batchIds;
  } catch (error) {
    console.error("Error fetching batch IDs:", error);
    
    // Fallback: try to get all batches by iterating
    if (error.message.includes("function not found")) {
      console.log("Using fallback method for getAllBatchIds");
      return [];
    }
    
    throw error;
  }
}

/**
 * Check batch existence
 * @param {string} batchId - Batch ID to check
 * @returns {Promise<boolean>} True if batch exists
 */
export async function checkBatchExists(batchId) {
  try {
    return await readOnlyContract.batchExists(batchId);
  } catch (error) {
    console.error(`Error checking existence of batch ${batchId}:`, error);
    return false;
  }
}

/**
 * Get batch details with enhanced error handling
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Batch details
 */
export async function getBatchDetails(batchId) {
  try {
    const exists = await checkBatchExists(batchId);
    if (!exists) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const batch = await readOnlyContract.getBatch(batchId);
    const createdAt = new Date(Number(batch[6]) * 1000);

    return {
      productName: batch[0],
      batchId: batch[1],
      producer: batch[2],
      currentOwner: batch[3],
      status: batch[4],
      certHash: batch[5],
      createdAt: createdAt,
      timestamp: createdAt.toLocaleString(),
      formattedDate: createdAt.toISOString().split('T')[0],
      isHalalCertified: batch[5] && batch[5].length > 0,
    };
  } catch (error) {
    console.error(`Error fetching batch details for ${batchId}:`, error);
    throw error;
  }
}

/**
 * Get wallet provider for MetaMask
 * @returns {ethers.BrowserProvider} Browser provider instance
 */
export function getWalletProvider() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed');
  }
  return new ethers.BrowserProvider(window.ethereum);
}

/**
 * Get signer from wallet
 * @returns {Promise<ethers.Signer>} Signer instance
 */
export async function getWalletSigner() {
  const provider = getWalletProvider();
  return await provider.getSigner();
}

/**
 * Get contract instance with connected wallet signer
 * @returns {Promise<ethers.Contract>} Contract instance with signer
 */
export async function getContractWithWallet() {
  const signer = await getWalletSigner();
  return getContractWithSigner(signer);
}

/**
 * Get connected wallet address
 * @returns {Promise<string>} Wallet address
 */
export async function getWalletAddress() {
  try {
    const provider = getWalletProvider();
    const accounts = await provider.send("eth_requestAccounts", []);
    return accounts[0].toLowerCase();
  } catch (error) {
    console.error("Error getting wallet address:", error);
    throw error;
  }
}

// ============= EVENT LISTENING FUNCTIONS =============

/**
 * Listen for BatchCreated events
 * @param {Function} callback - Callback function when event occurs
 * @returns {Function} Function to unsubscribe
 */
export function onBatchCreated(callback) {
  const filter = readOnlyContract.filters.BatchCreated();
  
  const listener = (...args) => {
    const event = args[args.length - 1];
    callback({
      batchId: event.args.batchId,
      productName: event.args.productName,
      creator: event.args.creator,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
    });
  };

  readOnlyContract.on(filter, listener);
  
  // Return unsubscribe function
  return () => {
    readOnlyContract.off(filter, listener);
  };
}

/**
 * Get past BatchCreated events
 * @param {number} fromBlock - Starting block number
 * @param {number} toBlock - Ending block number (default: latest)
 * @returns {Promise<Array>} Array of past events
 */
export async function getPastBatchCreatedEvents(fromBlock = 0, toBlock = 'latest') {
  try {
    const filter = readOnlyContract.filters.BatchCreated();
    const events = await readOnlyContract.queryFilter(filter, fromBlock, toBlock);
    
    return events.map(event => ({
      batchId: event.args.batchId,
      productName: event.args.productName,
      creator: event.args.creator,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: event.blockTimestamp,
    }));
  } catch (error) {
    console.error("Error fetching past events:", error);
    return [];
  }
}