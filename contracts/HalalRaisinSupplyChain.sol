// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OpenZeppelin libraries used for role management
// and handling address lists safely
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/*
 * HalalRaisinSupplyChain
 * This contract is used to track halal product batches on the blockchain.
 * Phase 1 focuses on basic batch creation, certification, transfer,
 * and public verification.
 */
contract HalalRaisinSupplyChain is AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Roles used in the supply chain
    bytes32 public constant PRODUCER_ROLE = keccak256("PRODUCER");
    bytes32 public constant HALAL_AUTHORITY_ROLE = keccak256("HALAL_AUTHORITY");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER");

    // Stores information about one batch of products
    struct Batch {
        string productName;      // Name of the product
        string batchId;          // Unique ID for the batch
        address producer;        // Address of the producer
        address currentOwner;    // Current owner of the batch
        string status;           // Current status of the batch
        string halalCertHash;    // Halal certificate reference (IPFS hash)
        uint256 createdAt;       // Time when the batch was created
    }

    // Maps batch ID to batch data
    mapping(string => Batch) public batches;

    // Used to check if a batch exists
    mapping(string => bool) public batchExists;

    // Lists of participants in the supply chain
    EnumerableSet.AddressSet private producers;
    EnumerableSet.AddressSet private distributors;
    EnumerableSet.AddressSet private retailers;

    // Events used for logging important actions
    event BatchCreated(string batchId, string productName, address creator);
    event HalalCertified(string batchId, string certHash, address certifier);
    event StatusUpdated(string batchId, string newStatus, address updater);
    event BatchTransferred(string batchId, address from, address to);

    // Makes sure the batch exists before continuing
    modifier onlyExistingBatch(string memory batchId) {
        require(batchExists[batchId], "Batch does not exist");
        _;
    }

    // Contract setup
    // The deployer becomes the admin and a producer
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PRODUCER_ROLE, msg.sender);
        producers.add(msg.sender);
    }

    // Add a new producer
    function assignProducer(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(PRODUCER_ROLE, account);
        producers.add(account);
    }

    // Add a halal authority
    function assignHalalAuthority(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(HALAL_AUTHORITY_ROLE, account);
    }

    // Add a distributor
    function assignDistributor(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(DISTRIBUTOR_ROLE, account);
        distributors.add(account);
    }

    // Add a retailer
    function assignRetailer(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(RETAILER_ROLE, account);
        retailers.add(account);
    }

    // Allows a producer to create a new batch
    function createBatch(string memory batchId, string memory productName)
        external
        onlyRole(PRODUCER_ROLE)
    {
        require(bytes(batchId).length > 0, "Batch ID required");
        require(!batchExists[batchId], "Batch already exists");

        batches[batchId] = Batch({
            productName: productName,
            batchId: batchId,
            producer: msg.sender,
            currentOwner: msg.sender,
            status: "Produced",
            halalCertHash: "",
            createdAt: block.timestamp
        });

        batchExists[batchId] = true;
        emit BatchCreated(batchId, productName, msg.sender);
    }

    // Used by halal authority to certify a batch
    function setHalalCertificate(string memory batchId, string memory certHash)
        external
        onlyRole(HALAL_AUTHORITY_ROLE)
        onlyExistingBatch(batchId)
    {
        batches[batchId].halalCertHash = certHash;
        batches[batchId].status = "Certified Halal";
        emit HalalCertified(batchId, certHash, msg.sender);
    }

    // Updates the batch status as it moves through the supply chain
    function updateStatus(string memory batchId, string memory newStatus)
        external
        onlyExistingBatch(batchId)
    {
        Batch storage batch = batches[batchId];

        require(
            msg.sender == batch.currentOwner ||
            hasRole(PRODUCER_ROLE, msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(RETAILER_ROLE, msg.sender),
            "Not authorized"
        );

        batch.status = newStatus;
        emit StatusUpdated(batchId, newStatus, msg.sender);
    }

    // Transfers ownership following the supply chain order
    function transferBatch(string memory batchId, address to)
        external
        onlyExistingBatch(batchId)
    {
        Batch storage batch = batches[batchId];
        require(msg.sender == batch.currentOwner, "Only owner can transfer");

        if (producers.contains(batch.currentOwner)) {
            require(distributors.contains(to), "Producer -> Distributor only");
        } else if (distributors.contains(batch.currentOwner)) {
            require(retailers.contains(to), "Distributor -> Retailer only");
        }

        batch.currentOwner = to;
        emit BatchTransferred(batchId, msg.sender, to);
    }

    // Public function to read batch information
    // Used by consumers or external applications
    function getBatch(string memory batchId)
        external
        view
        onlyExistingBatch(batchId)
        returns (
            string memory,
            string memory,
            address,
            address,
            string memory,
            string memory,
            uint256
        )
    {
        Batch memory b = batches[batchId];
        return (
            b.productName,
            b.batchId,
            b.producer,
            b.currentOwner,
            b.status,
            b.halalCertHash,
            b.createdAt
        );
    }
}
