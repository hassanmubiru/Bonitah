// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockERC20
/// @notice Minimal, self-contained, standards-compliant ERC20 used as a configurable
///         test stablecoin for BFN contract tests and local/testnet wiring.
/// @dev Not for production. Exposes open `mint`/`burn` so tests can fund any account
///      and configurable `name`/`symbol`/`decimals` so it can emulate stablecoins
///      such as a 6-decimal USDC-like token. Fully compatible with OpenZeppelin's
///      SafeERC20 used by the vault and treasury contracts (Req 4.5, 13.2).
contract MockERC20 {
    /// @notice Emitted on token transfers, including mints (from zero) and burns (to zero).
    event Transfer(address indexed from, address indexed to, uint256 value);
    /// @notice Emitted when an allowance is set via `approve`.
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance(address account, uint256 balance, uint256 needed);
    error InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error InvalidReceiver(address receiver);
    error InvalidSender(address sender);

    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @param name_ Token name (e.g. "Bonitah Test USD").
    /// @param symbol_ Token symbol (e.g. "bUSD").
    /// @param decimals_ Token decimals (e.g. 6 to emulate USDC).
    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
    }

    /// @notice Approve `spender` to transfer up to `value` tokens on the caller's behalf.
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /// @notice Transfer `value` tokens from the caller to `to`.
    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    /// @notice Transfer `value` tokens from `from` to `to` using the caller's allowance.
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        return true;
    }

    /// @notice Mint `value` tokens to `to`. Open for test convenience.
    function mint(address to, uint256 value) external {
        if (to == address(0)) revert InvalidReceiver(address(0));
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }

    /// @notice Burn `value` tokens from `from`. Open for test convenience.
    function burn(address from, uint256 value) external {
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance(from, bal, value);
        unchecked {
            balanceOf[from] = bal - value;
            totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) revert InvalidSender(address(0));
        if (to == address(0)) revert InvalidReceiver(address(0));
        uint256 fromBal = balanceOf[from];
        if (fromBal < value) revert InsufficientBalance(from, fromBal, value);
        unchecked {
            balanceOf[from] = fromBal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal {
        uint256 current = allowance[owner][spender];
        if (current != type(uint256).max) {
            if (current < value) revert InsufficientAllowance(spender, current, value);
            unchecked {
                allowance[owner][spender] = current - value;
            }
        }
    }
}
