// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/**
 * @title DeployMockToken
 * @notice Deploys a mock ERC20 stablecoin for testing
 * 
 * Usage:
 *   forge script script/DeployMockToken.s.sol:DeployMockToken --rpc-url $BASE_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
 */
contract DeployMockToken is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying MockERC20 token...");
        console.log("Deployer address:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        MockERC20 token = new MockERC20("Bonitah Test USD", "bUSD", 6);
        
        vm.stopBroadcast();
        
        console.log("MockERC20 deployed at:", address(token));
        console.log("Token name:", token.name());
        console.log("Token symbol:", token.symbol());
        console.log("Initial supply:", token.totalSupply());
        
        // Mint some tokens to deployer for testing
        vm.startBroadcast(deployerPrivateKey);
        token.mint(deployer, 1000000 * 1e18); // 1M tokens
        vm.stopBroadcast();
        
        console.log("Minted 1,000,000 tokens to deployer");
    }
}