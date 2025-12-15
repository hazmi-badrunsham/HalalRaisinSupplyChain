// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } = process.env;

module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111, // Sepolia chain ID
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337, // Hardhat local chain ID
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};