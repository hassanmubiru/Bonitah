// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RemixVerification - BFN Contract Interaction Helper
 * @notice Simple contract to verify and interact with BFN contracts from Remix IDE
 * @dev Deploy this on Remix to easily test all BFN contract functionality
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IRegistry {
    function register() external;
    function isRegistered(address user) external view returns (bool);
    function getProfile(address user) external view returns (
        bool registered,
        bool verified,
        uint256 reputationScore,
        uint256 registeredAt,
        string memory ipfsProfileHash
    );
    function reputationOf(address user) external view returns (uint256);
}

interface ISavingsVault {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function availableBalance(address user) external view returns (uint256);
    function token() external view returns (address);
}

interface IEducationContent {
    function courseCount() external view returns (uint256);
    function createCourse(string calldata title, string calldata description, string calldata ipfsContentHash) external returns (uint256);
    function getCourse(uint256 courseId) external view returns (
        string memory title,
        string memory description,
        string memory ipfsContentHash,
        uint256 totalLessons,
        bool active,
        uint256 createdAt,
        address creator
    );
}

interface IConversationManager {
    function createConversation(string calldata title) external returns (bytes32);
    function addMessage(bytes32 conversationId, string calldata content, bool isAiResponse, string calldata ipfsMetadataHash) external;
    function getConversation(bytes32 conversationId) external view returns (
        address user,
        uint256 createdAt,
        uint256 lastMessageAt,
        uint256 messageCount,
        bool active,
        string memory title
    );
}

contract RemixVerification {
    // BFN Contract addresses on Base Sepolia
    address public constant USDC_TOKEN = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address public constant REGISTRY = 0xA8C8bD142579a470D481237e243C95E6a5a6b42f;
    address public constant SAVINGS_VAULT = 0x0600d96F8f0A0A36C1C19710dDd84FB4ef171D84;
    address public constant EDUCATION_CONTENT = 0x1a346E765cB2e9bd313C65bc64786945D3508Cd8;
    address public constant CONVERSATION_MANAGER = 0x16dc262EE9A49c6497625E37846DBe8f9Bd5E82A;
    
    // Events for verification
    event ContractVerified(string contractName, address contractAddress, bool success);
    event UserRegistered(address user, bool success);
    event DepositMade(address user, uint256 amount, bool success);
    event ConversationCreated(address user, bytes32 conversationId);
    
    /**
     * @notice Verify all BFN contracts are deployed and responding
     */
    function verifyAllContracts() external returns (bool allVerified) {
        allVerified = true;
        
        // Verify USDC token
        try IERC20(USDC_TOKEN).balanceOf(address(this)) returns (uint256) {
            emit ContractVerified("USDC", USDC_TOKEN, true);
        } catch {
            emit ContractVerified("USDC", USDC_TOKEN, false);
            allVerified = false;
        }
        
        // Verify Registry
        try IRegistry(REGISTRY).isRegistered(msg.sender) returns (bool) {
            emit ContractVerified("Registry", REGISTRY, true);
        } catch {
            emit ContractVerified("Registry", REGISTRY, false);
            allVerified = false;
        }
        
        // Verify SavingsVault
        try ISavingsVault(SAVINGS_VAULT).token() returns (address token) {
            bool usdcMatch = (token == USDC_TOKEN);
            emit ContractVerified("SavingsVault", SAVINGS_VAULT, usdcMatch);
            if (!usdcMatch) allVerified = false;
        } catch {
            emit ContractVerified("SavingsVault", SAVINGS_VAULT, false);
            allVerified = false;
        }
        
        // Verify EducationContent
        try IEducationContent(EDUCATION_CONTENT).courseCount() returns (uint256) {
            emit ContractVerified("EducationContent", EDUCATION_CONTENT, true);
        } catch {
            emit ContractVerified("EducationContent", EDUCATION_CONTENT, false);
            allVerified = false;
        }
    }
    
    /**
     * @notice Complete user registration flow
     */
    function registerUser() external {
        try IRegistry(REGISTRY).register() {
            emit UserRegistered(msg.sender, true);
        } catch {
            emit UserRegistered(msg.sender, false);
        }
    }
    
    /**
     * @notice Check user registration status
     */
    function checkUserStatus(address user) external view returns (
        bool isRegistered,
        uint256 reputation,
        uint256 usdcBalance,
        uint256 vaultBalance
    ) {
        isRegistered = IRegistry(REGISTRY).isRegistered(user);
        reputation = IRegistry(REGISTRY).reputationOf(user);
        usdcBalance = IERC20(USDC_TOKEN).balanceOf(user);
        vaultBalance = ISavingsVault(SAVINGS_VAULT).availableBalance(user);
    }
    
    /**
     * @notice Test USDC deposit to vault (requires prior approval)
     */
    function testDeposit(uint256 amount) external {
        // First user must approve: USDC.approve(SAVINGS_VAULT, amount)
        try ISavingsVault(SAVINGS_VAULT).deposit(amount) {
            emit DepositMade(msg.sender, amount, true);
        } catch {
            emit DepositMade(msg.sender, amount, false);
        }
    }
    
    /**
     * @notice Create test conversation
     */
    function createTestConversation() external returns (bytes32 conversationId) {
        try IConversationManager(CONVERSATION_MANAGER).createConversation("Remix Test Chat") returns (bytes32 id) {
            conversationId = id;
            emit ConversationCreated(msg.sender, conversationId);
        } catch {
            conversationId = bytes32(0);
            emit ConversationCreated(msg.sender, bytes32(0));
        }
    }
    
    /**
     * @notice Get comprehensive system status
     */
    function getSystemStatus() external view returns (
        uint256 totalCourses,
        address vaultToken,
        bool userRegistered,
        uint256 userReputation,
        uint256 userUsdcBalance,
        uint256 userVaultBalance
    ) {
        totalCourses = IEducationContent(EDUCATION_CONTENT).courseCount();
        vaultToken = ISavingsVault(SAVINGS_VAULT).token();
        userRegistered = IRegistry(REGISTRY).isRegistered(msg.sender);
        userReputation = IRegistry(REGISTRY).reputationOf(msg.sender);
        userUsdcBalance = IERC20(USDC_TOKEN).balanceOf(msg.sender);
        userVaultBalance = ISavingsVault(SAVINGS_VAULT).availableBalance(msg.sender);
    }
    
    /**
     * @notice Emergency function to check if we're on the right network
     */
    function verifyNetwork() external view returns (uint256 chainId, bool isBaseSepolia) {
        chainId = block.chainid;
        isBaseSepolia = (chainId == 84532);
    }
}