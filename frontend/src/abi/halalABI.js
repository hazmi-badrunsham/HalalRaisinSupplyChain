export const HALAL_ABI = [
  // ✅ Include ALL functions — especially createBatch
  {
    "inputs": [
      { "internalType": "string", "name": "batchId", "type": "string" },
      { "internalType": "string", "name": "productName", "type": "string" }
    ],
    "name": "createBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "name": "batchExists",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "batchId", "type": "string" }],
    "name": "getBatch",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" },
      { "internalType": "string", "name": "", "type": "string" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "string", "name": "", "type": "string" },
      { "internalType": "string", "name": "", "type": "string" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // 👇 Add other functions you'll need later
  {
    "inputs": [
      { "internalType": "string", "name": "batchId", "type": "string" },
      { "internalType": "string", "name": "certHash", "type": "string" }
    ],
    "name": "setHalalCertificate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "batchId", "type": "string" },
      { "internalType": "string", "name": "newStatus", "type": "string" }
    ],
    "name": "updateStatus",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "batchId", "type": "string" },
      { "internalType": "address", "name": "to", "type": "address" }
    ],
    "name": "transferBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
  "anonymous": false,
  "inputs": [
    { "indexed": false, "internalType": "string", "name": "batchId", "type": "string" },
    { "indexed": false, "internalType": "string", "name": "productName", "type": "string" },
    { "indexed": true, "internalType": "address", "name": "creator", "type": "address" }
  ],
  "name": "BatchCreated",
  "type": "event"
}
  // Roles, etc. (optional for now)
];
