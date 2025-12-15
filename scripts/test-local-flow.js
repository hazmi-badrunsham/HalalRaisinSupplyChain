// scripts/test-local-flow.js
const hre = require("hardhat");

async function main() {
    // Get 5 test accounts from Hardhat (they have free ETH)
    const [admin, producer, authority, distributor, retailer, consumer] = await hre.ethers.getSigners();

    console.log("🧪 Starting local test flow for Halal Raisin Supply Chain...\n");

    // Deploy contract (admin = deployer = default producer)
    const HalalRaisin = await hre.ethers.getContractFactory("HalalRaisinSupplyChain");
    const contract = await HalalRaisin.deploy();
    await contract.waitForDeployment();
    console.log("✅ Contract deployed by:", admin.address);

    // Assign roles
    await contract.assignProducer(producer.address);
    await contract.assignHalalAuthority(authority.address);
    await contract.assignDistributor(distributor.address);
    await contract.assignRetailer(retailer.address);
    console.log("👥 Roles assigned to test accounts.\n");

    // --- PRODUCER: Create batch ---
    const contractAsProducer = contract.connect(producer);
    await contractAsProducer.createBatch("RAISIN-2025-001", "Premium Organic Raisins");
    console.log("🍇 Batch created by Producer:", producer.address);

    // --- HALAL AUTHORITY: Certify ---
    const contractAsAuthority = contract.connect(authority);
    await contractAsAuthority.setHalalCertificate("RAISIN-2025-001", "QmRaisinCert123");
    console.log("🕌 Batch certified Halal by Authority:", authority.address);

    // --- PRODUCER: Transfer to Distributor ---
    await contractAsProducer.transferBatch("RAISIN-2025-001", distributor.address);
    console.log("🚛 Transferred from Producer to Distributor");

    // --- DISTRIBUTOR: Update status + Transfer to Retailer ---
    const contractAsDistributor = contract.connect(distributor);
    await contractAsDistributor.updateStatus("RAISIN-2025-001", "In Transit");
    console.log("📝 Status updated to 'In Transit'");
    await contractAsDistributor.transferBatch("RAISIN-2025-001", retailer.address);
    console.log("🏪 Transferred from Distributor to Retailer");

    // --- RETAILER: Update status ---
    const contractAsRetailer = contract.connect(retailer);
    await contractAsRetailer.updateStatus("RAISIN-2025-001", "At Retailer");
    console.log("🛒 Status updated to 'At Retailer'\n");

    // --- CONSUMER: Query batch info ---
    const batch = await contract.getBatch("RAISIN-2025-001");
    console.log("🔍 Consumer view of batch 'RAISIN-2025-001':");
    console.log("   Product Name:", batch[0]);
    console.log("   Batch ID:", batch[1]);
    console.log("   Producer:", batch[2]);
    console.log("   Current Owner:", batch[3]);
    console.log("   Status:", batch[4]);
    console.log("   Halal Cert Hash:", batch[5]);

    console.log("\n✅ End-to-end test completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });