// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OpenZeppelin libraries used for role management
// and handling address lists safely
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/*
 * HalalRaisinSupplyChain V2
 * This contract is used to track halal product batches on the blockchain.
 * Phase 1 focuses on basic batch creation, certification, transfer,
 * and public verification.
 */
contract HalalRaisinSupplyChainV2 is AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.StringSet;

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
        bool exists;             // For batch existence check
    }

    // Maps batch ID to batch data
    mapping(string => Batch) public batches;

    // NEW: Track all batch IDs
    EnumerableSet.StringSet private allBatchIds;
    
    // NEW: Track batches by creator
    mapping(address => EnumerableSet.StringSet) private batchesByCreator;
    
    // NEW: Track batches by current owner
    mapping(address => EnumerableSet.StringSet) private batchesByOwner;

    // Lists of participants in the supply chain
    EnumerableSet.AddressSet private producers;
    EnumerableSet.AddressSet private distributors;
    EnumerableSet.AddressSet private retailers;

    // Events used for logging important actions
    event BatchCreated(string indexed batchId, string productName, address indexed creator);
    event HalalCertified(string indexed batchId, string certHash, address indexed certifier);
    event StatusUpdated(string indexed batchId, string newStatus, address indexed updater);
    event BatchTransferred(string indexed batchId, address indexed from, address indexed to);

    // Makes sure the batch exists before continuing
    modifier onlyExistingBatch(string memory batchId) {
        require(batches[batchId].exists, "Batch does not exist");
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
        require(!batches[batchId].exists, "Batch already exists");

        batches[batchId] = Batch({
            productName: productName,
            batchId: batchId,
            producer: msg.sender,
            currentOwner: msg.sender,
            status: "Produced",
            halalCertHash: "",
            createdAt: block.timestamp,
            exists: true
        });

        // NEW: Add to tracking sets
        allBatchIds.add(batchId);
        batchesByCreator[msg.sender].add(batchId);
        batchesByOwner[msg.sender].add(batchId);

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

        // NEW: Update owner tracking
        batchesByOwner[batch.currentOwner].remove(batchId);
        batch.currentOwner = to;
        batchesByOwner[to].add(batchId);

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

    // NEW: Check if batch exists (replaces batchExists mapping)
    function batchExists(string memory batchId) external view returns (bool) {
        return batches[batchId].exists;
    }

    // ============= NEW FUNCTIONS FOR BATCH LISTING =============

    /**
     * @dev Get all batch IDs (paginated for gas efficiency)
     * @param start Starting index (0-based)
     * @param limit Maximum number of batch IDs to return
     */
    function getAllBatchIds(uint256 start, uint256 limit) 
        external 
        view 
        returns (string[] memory) 
    {
        uint256 total = allBatchIds.length();
        require(start < total, "Start index out of bounds");
        
        uint256 end = start + limit;
        if (end > total) {
            end = total;
        }
        
        string[] memory result = new string[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = allBatchIds.at(i);
        }
        return result;
    }

    /**
     * @dev Get total number of batches
     */
    function getTotalBatchCount() external view returns (uint256) {
        return allBatchIds.length();
    }

    /**
     * @dev Get batch IDs created by a specific address
     * @param creator Address of the creator
     */
    function getBatchesByCreator(address creator) 
        external 
        view 
        returns (string[] memory) 
    {
        return batchesByCreator[creator].values();
    }

    /**
     * @dev Get batch IDs owned by a specific address
     * @param owner Address of the current owner
     */
    function getBatchesByOwner(address owner) 
        external 
        view 
        returns (string[] memory) 
    {
        return batchesByOwner[owner].values();
    }

    /**
     * @dev Get batch count created by a specific address
     */
    function getBatchCountByCreator(address creator) 
        external 
        view 
        returns (uint256) 
    {
        return batchesByCreator[creator].length();
    }

    /**
     * @dev Get batch IDs with specific status (paginated)
     * Note: This is gas-intensive, use only for small datasets
     */
    function getBatchesByStatus(string memory status, uint256 start, uint256 limit)
        external
        view
        returns (string[] memory)
    {
        uint256 count = 0;
        uint256 total = allBatchIds.length();
        
        // First pass to count
        for (uint256 i = 0; i < total; i++) {
            if (keccak256(bytes(batches[allBatchIds.at(i)].status)) == keccak256(bytes(status))) {
                count++;
            }
        }
        
        require(start < count, "Start index out of bounds");
        
        uint256 end = start + limit;
        if (end > count) {
            end = count;
        }
        
        string[] memory result = new string[](end - start);
        uint256 current = 0;
        uint256 resultIndex = 0;
        
        // Second pass to collect
        for (uint256 i = 0; i < total && resultIndex < (end - start); i++) {
            string memory batchId = allBatchIds.at(i);
            if (keccak256(bytes(batches[batchId].status)) == keccak256(bytes(status))) {
                if (current >= start) {
                    result[resultIndex] = batchId;
                    resultIndex++;
                }
                current++;
            }
        }
        
        return result;
    }

    /**
     * @dev Get multiple batches in one call (for efficiency)
     */
    function getMultipleBatches(string[] memory batchIds)
        external
        view
        returns (
            string[] memory productNames,
            string[] memory batchIdsResult,
            address[] memory producersArr,
            address[] memory currentOwners,
            string[] memory statuses,
            string[] memory certHashes,
            uint256[] memory createdAts
        )
    {
        uint256 length = batchIds.length;
        
        productNames = new string[](length);
        batchIdsResult = new string[](length);
        producersArr = new address[](length);
        currentOwners = new address[](length);
        statuses = new string[](length);
        certHashes = new string[](length);
        createdAts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            require(batches[batchIds[i]].exists, "Batch does not exist");
            Batch memory b = batches[batchIds[i]];
            
            productNames[i] = b.productName;
            batchIdsResult[i] = b.batchId;
            producersArr[i] = b.producer;
            currentOwners[i] = b.currentOwner;
            statuses[i] = b.status;
            certHashes[i] = b.halalCertHash;
            createdAts[i] = b.createdAt;
        }
    }
}