// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BFNAccessUUPSUpgradeable} from "./base/BFNAccessUUPSUpgradeable.sol";
import {BFNRoles} from "./base/BFNRoles.sol";

/**
 * @title EventIndexer - On-Chain Event Tracking Backend
 * @notice Decentralized event indexing and transaction history on smart contracts
 * @dev Replaces off-chain backend with fully on-chain event storage and querying
 */
contract EventIndexer is Initializable, BFNAccessUUPSUpgradeable {
    /// @notice Indexed event structure
    struct IndexedEvent {
        bytes32 txHash;
        uint256 blockNumber;
        uint256 logIndex;
        address contractAddress;
        bytes32 eventSignature;
        address userAddress; // Extracted from event data
        uint256 amount; // For financial events
        uint256 timestamp;
        bytes eventData; // Raw event data
        string eventType; // Human-readable event type
    }
    
    /// @notice Transaction summary for user
    struct TransactionSummary {
        bytes32 txHash;
        uint256 blockNumber;
        uint256 timestamp;
        string transactionType; // deposit, withdraw, vote, etc.
        uint256 amount;
        address contractAddress;
        uint256 eventCount; // Number of events in this transaction
    }

    // Storage
    mapping(bytes32 => IndexedEvent) public events; // eventId => event
    mapping(address => bytes32[]) public userEvents; // user => event IDs
    mapping(address => TransactionSummary[]) public userTransactions; // user => transactions
    mapping(bytes32 => uint256) public transactionEventCount; // txHash => event count
    
    uint256 public totalEvents;
    uint256 public lastProcessedBlock;
    
    // Events
    event EventIndexed(
        bytes32 indexed eventId,
        address indexed userAddress,
        bytes32 indexed txHash,
        string eventType
    );
    event TransactionProcessed(
        bytes32 indexed txHash,
        address indexed userAddress,
        string transactionType,
        uint256 eventCount
    );
    
    // Errors
    error EventAlreadyIndexed(bytes32 eventId);
    error InvalidEventData();
    error UnauthorizedIndexer();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __BFNAccessUUPS_init(admin);
    }
    
    /**
     * @notice Index a blockchain event (admin/indexer only)
     * @param txHash Transaction hash
     * @param blockNumber Block number
     * @param logIndex Log index in transaction
     * @param contractAddress Contract that emitted the event
     * @param eventSignature Keccak256 hash of event signature
     * @param userAddress User address extracted from event
     * @param amount Amount involved in transaction (if applicable)
     * @param eventData Raw event data
     * @param eventType Human-readable event type
     */
    function indexEvent(
        bytes32 txHash,
        uint256 blockNumber,
        uint256 logIndex,
        address contractAddress,
        bytes32 eventSignature,
        address userAddress,
        uint256 amount,
        bytes calldata eventData,
        string calldata eventType
    ) external onlyRole(BFNRoles.DEFAULT_ADMIN_ROLE) {
        
        // Generate unique event ID
        bytes32 eventId = keccak256(abi.encodePacked(txHash, logIndex));
        
        // Prevent duplicate indexing
        if (events[eventId].txHash != bytes32(0)) revert EventAlreadyIndexed(eventId);
        if (bytes(eventType).length == 0) revert InvalidEventData();
        
        // Store event
        IndexedEvent storage evt = events[eventId];
        evt.txHash = txHash;
        evt.blockNumber = blockNumber;
        evt.logIndex = logIndex;
        evt.contractAddress = contractAddress;
        evt.eventSignature = eventSignature;
        evt.userAddress = userAddress;
        evt.amount = amount;
        evt.timestamp = block.timestamp; // Use current timestamp or extract from block
        evt.eventData = eventData;
        evt.eventType = eventType;
        
        // Add to user's event list
        if (userAddress != address(0)) {
            userEvents[userAddress].push(eventId);
        }
        
        totalEvents++;
        
        // Update transaction summary
        _updateTransactionSummary(txHash, userAddress, eventType, amount, contractAddress);
        
        emit EventIndexed(eventId, userAddress, txHash, eventType);
    }
    
    /**
     * @notice Update transaction summary for user
     * @param txHash Transaction hash
     * @param userAddress User address
     * @param eventType Type of event
     * @param amount Amount involved
     * @param contractAddress Contract address
     */
    function _updateTransactionSummary(
        bytes32 txHash,
        address userAddress,
        string memory eventType,
        uint256 amount,
        address contractAddress
    ) private {
        if (userAddress == address(0)) return;
        
        // Check if transaction already exists for user
        TransactionSummary[] storage transactions = userTransactions[userAddress];
        
        // Look for existing transaction
        bool found = false;
        for (uint256 i = transactions.length; i > 0; i--) {
            if (transactions[i-1].txHash == txHash) {
                // Update existing transaction
                transactions[i-1].eventCount++;
                found = true;
                break;
            }
        }
        
        if (!found) {
            // Create new transaction summary
            TransactionSummary memory summary = TransactionSummary({
                txHash: txHash,
                blockNumber: events[keccak256(abi.encodePacked(txHash, uint256(0)))].blockNumber,
                timestamp: block.timestamp,
                transactionType: eventType,
                amount: amount,
                contractAddress: contractAddress,
                eventCount: 1
            });
            
            transactions.push(summary);
            
            emit TransactionProcessed(txHash, userAddress, eventType, 1);
        }
        
        transactionEventCount[txHash]++;
    }
    
    /**
     * @notice Get events for a user (with pagination)
     * @param user User address
     * @param offset Starting index (most recent first)
     * @param limit Maximum events to return
     * @return eventIds Array of event IDs
     */
    function getUserEvents(address user, uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory eventIds)
    {
        bytes32[] storage allEvents = userEvents[user];
        uint256 totalCount = allEvents.length;
        
        if (totalCount == 0 || offset >= totalCount) return new bytes32[](0);
        
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        
        eventIds = new bytes32[](end - offset);
        
        // Return most recent events first (reverse order)
        for (uint256 i = offset; i < end; i++) {
            eventIds[i - offset] = allEvents[totalCount - 1 - i];
        }
    }
    
    /**
     * @notice Get user transactions (with pagination)
     * @param user User address
     * @param offset Starting index (most recent first)
     * @param limit Maximum transactions to return
     * @return transactions Array of transaction summaries
     */
    function getUserTransactions(address user, uint256 offset, uint256 limit)
        external
        view
        returns (TransactionSummary[] memory transactions)
    {
        TransactionSummary[] storage allTransactions = userTransactions[user];
        uint256 totalCount = allTransactions.length;
        
        if (totalCount == 0 || offset >= totalCount) return new TransactionSummary[](0);
        
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        
        transactions = new TransactionSummary[](end - offset);
        
        // Return most recent transactions first (reverse order)
        for (uint256 i = offset; i < end; i++) {
            transactions[i - offset] = allTransactions[totalCount - 1 - i];
        }
    }
    
    /**
     * @notice Get specific event by ID
     * @param eventId Event identifier
     * @return event IndexedEvent data
     */
    function getEvent(bytes32 eventId) external view returns (IndexedEvent memory) {
        return events[eventId];
    }
    
    /**
     * @notice Get user event count
     * @param user User address
     * @return count Total events for user
     */
    function getUserEventCount(address user) external view returns (uint256 count) {
        return userEvents[user].length;
    }
    
    /**
     * @notice Get user transaction count
     * @param user User address
     * @return count Total transactions for user
     */
    function getUserTransactionCount(address user) external view returns (uint256 count) {
        return userTransactions[user].length;
    }
    
    /**
     * @notice Update last processed block (indexer management)
     * @param blockNumber Latest block processed
     */
    function updateLastProcessedBlock(uint256 blockNumber) 
        external 
        onlyRole(BFNRoles.DEFAULT_ADMIN_ROLE) 
    {
        lastProcessedBlock = blockNumber;
    }
    
    /**
     * @notice Get user financial summary
     * @param user User address
     * @return totalDeposits Total deposit amount
     * @return totalWithdrawals Total withdrawal amount
     * @return transactionCount Total transaction count
     */
    function getUserFinancialSummary(address user)
        external
        view
        returns (uint256 totalDeposits, uint256 totalWithdrawals, uint256 transactionCount)
    {
        TransactionSummary[] storage transactions = userTransactions[user];
        transactionCount = transactions.length;
        
        for (uint256 i = 0; i < transactionCount; i++) {
            if (keccak256(bytes(transactions[i].transactionType)) == keccak256(bytes("deposit"))) {
                totalDeposits += transactions[i].amount;
            } else if (keccak256(bytes(transactions[i].transactionType)) == keccak256(bytes("withdraw"))) {
                totalWithdrawals += transactions[i].amount;
            }
        }
    }
}