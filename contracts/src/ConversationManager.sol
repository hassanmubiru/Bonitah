// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BFNAccessUUPSUpgradeable} from "./base/BFNAccessUUPSUpgradeable.sol";
import {BFNRoles} from "./base/BFNRoles.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";

/**
 * @title ConversationManager - On-Chain AI Chat Backend
 * @notice Decentralized conversation and message storage on smart contracts
 * @dev Replaces off-chain backend with fully on-chain chat history and AI interaction logging
 */
contract ConversationManager is Initializable, BFNAccessUUPSUpgradeable {
    /// @notice Message structure for chat history
    struct Message {
        string content;
        bool isAiResponse;
        uint256 timestamp;
        string ipfsMetadataHash; // Optional: store large content on IPFS
    }
    
    /// @notice Conversation metadata
    struct Conversation {
        address user;
        uint256 createdAt;
        uint256 lastMessageAt;
        uint256 messageCount;
        bool active;
        string title; // Auto-generated or user-set title
    }

    IRegistry public registry;
    
    // Storage
    mapping(bytes32 => Conversation) public conversations;
    mapping(bytes32 => mapping(uint256 => Message)) public messages; // conversationId => messageIndex => message
    mapping(address => bytes32[]) public userConversations; // user => conversation IDs
    mapping(address => uint256) public userConversationCount;
    
    // Events
    event ConversationCreated(bytes32 indexed conversationId, address indexed user, string title);
    event MessageSent(bytes32 indexed conversationId, address indexed user, string content, bool isAiResponse);
    event ConversationArchived(bytes32 indexed conversationId, address indexed user);
    
    // Errors
    error NotRegistered(address user);
    error ConversationNotFound(bytes32 conversationId);
    error UnauthorizedAccess(address user, bytes32 conversationId);
    error EmptyMessage();
    error ConversationInactive();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address _registry) external initializer {
        __BFNAccessUUPS_init(admin);
        registry = IRegistry(_registry);
    }
    
    /**
     * @notice Create a new conversation
     * @param title Optional conversation title
     * @return conversationId Unique identifier for the conversation
     */
    function createConversation(string calldata title) 
        external 
        returns (bytes32 conversationId) 
    {
        if (!registry.isRegistered(msg.sender)) revert NotRegistered(msg.sender);
        
        // Generate unique conversation ID
        conversationId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            userConversationCount[msg.sender]++
        ));
        
        Conversation storage conv = conversations[conversationId];
        conv.user = msg.sender;
        conv.createdAt = block.timestamp;
        conv.lastMessageAt = block.timestamp;
        conv.active = true;
        conv.title = bytes(title).length > 0 ? title : "New Conversation";
        
        userConversations[msg.sender].push(conversationId);
        
        emit ConversationCreated(conversationId, msg.sender, conv.title);
    }
    
    /**
     * @notice Add a message to a conversation
     * @param conversationId Target conversation
     * @param content Message content
     * @param isAiResponse Whether this is an AI-generated response
     * @param ipfsMetadataHash Optional IPFS hash for extended metadata
     */
    function addMessage(
        bytes32 conversationId,
        string calldata content,
        bool isAiResponse,
        string calldata ipfsMetadataHash
    ) external {
        Conversation storage conv = conversations[conversationId];
        
        // Verify conversation exists and user has access
        if (conv.user == address(0)) revert ConversationNotFound(conversationId);
        if (!isAiResponse && conv.user != msg.sender) revert UnauthorizedAccess(msg.sender, conversationId);
        if (!isAiResponse && !registry.isRegistered(msg.sender)) revert NotRegistered(msg.sender);
        if (!conv.active) revert ConversationInactive();
        if (bytes(content).length == 0) revert EmptyMessage();
        
        // For AI responses, allow system/admin to add messages
        if (isAiResponse && !hasRole(BFNRoles.DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedAccess(msg.sender, conversationId);
        }
        
        uint256 messageIndex = conv.messageCount++;
        Message storage message = messages[conversationId][messageIndex];
        message.content = content;
        message.isAiResponse = isAiResponse;
        message.timestamp = block.timestamp;
        message.ipfsMetadataHash = ipfsMetadataHash;
        
        conv.lastMessageAt = block.timestamp;
        
        emit MessageSent(conversationId, conv.user, content, isAiResponse);
    }
    
    /**
     * @notice Archive a conversation (user only)
     * @param conversationId Conversation to archive
     */
    function archiveConversation(bytes32 conversationId) external {
        Conversation storage conv = conversations[conversationId];
        if (conv.user == address(0)) revert ConversationNotFound(conversationId);
        if (conv.user != msg.sender) revert UnauthorizedAccess(msg.sender, conversationId);
        
        conv.active = false;
        
        emit ConversationArchived(conversationId, msg.sender);
    }
    
    /**
     * @notice Get conversation metadata
     * @param conversationId Conversation to query
     * @return Conversation struct data
     */
    function getConversation(bytes32 conversationId) 
        external 
        view 
        returns (Conversation memory) 
    {
        if (conversations[conversationId].user == address(0)) {
            revert ConversationNotFound(conversationId);
        }
        return conversations[conversationId];
    }
    
    /**
     * @notice Get a specific message from a conversation
     * @param conversationId Conversation ID
     * @param messageIndex Message index (0-based)
     * @return Message struct data
     */
    function getMessage(bytes32 conversationId, uint256 messageIndex) 
        external 
        view 
        returns (Message memory) 
    {
        Conversation storage conv = conversations[conversationId];
        if (conv.user == address(0)) revert ConversationNotFound(conversationId);
        if (messageIndex >= conv.messageCount) revert ConversationNotFound(conversationId);
        
        return messages[conversationId][messageIndex];
    }
    
    /**
     * @notice Get messages from a conversation (with pagination)
     * @param conversationId Conversation ID
     * @param offset Starting message index
     * @param limit Maximum messages to return
     * @return messageArray Array of messages
     */
    function getMessages(bytes32 conversationId, uint256 offset, uint256 limit)
        external
        view
        returns (Message[] memory messageArray)
    {
        Conversation storage conv = conversations[conversationId];
        if (conv.user == address(0)) revert ConversationNotFound(conversationId);
        
        if (offset >= conv.messageCount) return new Message[](0);
        
        uint256 end = offset + limit;
        if (end > conv.messageCount) end = conv.messageCount;
        
        messageArray = new Message[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            messageArray[i - offset] = messages[conversationId][i];
        }
    }
    
    /**
     * @notice Get all conversation IDs for a user
     * @param user User address
     * @return conversationIds Array of conversation IDs
     */
    function getUserConversations(address user) 
        external 
        view 
        returns (bytes32[] memory conversationIds) 
    {
        return userConversations[user];
    }
    
    /**
     * @notice Get conversation count for a user
     * @param user User address
     * @return count Number of conversations
     */
    function getUserConversationCount(address user) 
        external 
        view 
        returns (uint256 count) 
    {
        return userConversations[user].length;
    }
    
    /**
     * @notice Get recent conversations for a user (with limit)
     * @param user User address
     * @param limit Maximum conversations to return
     * @return conversationIds Array of most recent conversation IDs
     */
    function getRecentConversations(address user, uint256 limit)
        external
        view
        returns (bytes32[] memory conversationIds)
    {
        bytes32[] storage allConversations = userConversations[user];
        uint256 totalCount = allConversations.length;
        
        if (totalCount == 0) return new bytes32[](0);
        
        uint256 returnCount = limit > totalCount ? totalCount : limit;
        conversationIds = new bytes32[](returnCount);
        
        // Return most recent conversations (from end of array)
        for (uint256 i = 0; i < returnCount; i++) {
            conversationIds[i] = allConversations[totalCount - 1 - i];
        }
    }
}