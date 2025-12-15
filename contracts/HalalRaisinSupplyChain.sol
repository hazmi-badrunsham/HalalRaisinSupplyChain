// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract HalalRaisinSupplyChain is AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant PRODUCER_ROLE = keccak256("PRODUCER");
    bytes32 public constant HALAL_AUTHORITY_ROLE = keccak256("HALAL_AUTHORITY");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER");

    struct Batch {
        string productName;
        string batchId;
        address producer;
        address currentOwner;
        string status;
        string halalCertHash;
        uint256 createdAt;
    }

    mapping(string => Batch) public batches;
    mapping(string => bool) public batchExists;

    EnumerableSet.AddressSet private producers;
    EnumerableSet.AddressSet private distributors;
    EnumerableSet.AddressSet private retailers;

    event BatchCreated(string batchId, string productName, address creator);
    event HalalCertified(string batchId, string certHash, address certifier);
    event StatusUpdated(string batchId, string newStatus, address updater);
    event BatchTransferred(string batchId, address from, address to);

    modifier onlyExistingBatch(string memory batchId) {
        require(batchExists[batchId], "Batch does not exist");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PRODUCER_ROLE, msg.sender);
        producers.add(msg.sender);
    }

    function assignProducer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(PRODUCER_ROLE, account);
        producers.add(account);
    }

    function assignHalalAuthority(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(HALAL_AUTHORITY_ROLE, account);
    }

    function assignDistributor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(DISTRIBUTOR_ROLE, account);
        distributors.add(account);
    }

    function assignRetailer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(RETAILER_ROLE, account);
        retailers.add(account);
    }

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

    function setHalalCertificate(string memory batchId, string memory certHash)
        external
        onlyRole(HALAL_AUTHORITY_ROLE)
        onlyExistingBatch(batchId)
    {
        batches[batchId].halalCertHash = certHash;
        batches[batchId].status = "Certified Halal";
        emit HalalCertified(batchId, certHash, msg.sender);
    }

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
        return (b.productName, b.batchId, b.producer, b.currentOwner, b.status, b.halalCertHash, b.createdAt);
    }
}