// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Mock USDC token for testing the EventManager contract
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        // Mint 1 million USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDC has 6 decimals
    }

    // Allow anyone to mint tokens for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}