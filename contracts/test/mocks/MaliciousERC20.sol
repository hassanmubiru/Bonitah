// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CommunityTreasury} from "../../src/CommunityTreasury.sol";

/**
 * @title MaliciousERC20
 * @notice A malicious ERC20 token that attempts reentrancy attacks during transfers
 * @dev Used to test reentrancy protection in CommunityTreasury
 */
contract MaliciousERC20 is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    
    // Attack configuration
    CommunityTreasury public target;
    uint256 public attackPoolId;
    uint256 public attackAmount;
    uint256 public attackActionId;
    bool public attacking;
    
    string public name = "Malicious Token";
    string public symbol = "MAL";
    uint8 public decimals = 18;
    
    constructor() {
        _totalSupply = 1000000e18;
        _balances[msg.sender] = _totalSupply;
    }
    
    function setTarget(CommunityTreasury _target) external {
        target = _target;
    }
    
    function setAttackParams(uint256 _poolId, uint256 _amount, uint256 _actionId) external {
        attackPoolId = _poolId;
        attackAmount = _amount;
        attackActionId = _actionId;
    }
    
    function enableAttack() external {
        attacking = true;
    }
    
    function disableAttack() external {
        attacking = false;
    }
    
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: insufficient allowance");
        
        _transfer(from, to, amount);
        
        if (currentAllowance != type(uint256).max) {
            _allowances[from][msg.sender] = currentAllowance - amount;
        }
        
        // Attempt reentrancy after transfer
        if (attacking && address(target) != address(0)) {
            attacking = false; // Prevent infinite recursion
            try target.contribute(attackPoolId, attackAmount) {
                // Should fail due to reentrancy guard
            } catch {}
            
            try target.contributeToPool(attackPoolId, attackAmount) {
                // Should fail due to reentrancy guard
            } catch {}
            
            try target.vote(attackActionId) {
                // Should fail due to reentrancy guard
            } catch {}
        }
        
        return true;
    }
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to != address(0), "ERC20: transfer to zero address");
        
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        
        _balances[from] = fromBalance - amount;
        _balances[to] += amount;
        
        emit Transfer(from, to, amount);
    }
    
    function mint(address to, uint256 amount) external {
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}