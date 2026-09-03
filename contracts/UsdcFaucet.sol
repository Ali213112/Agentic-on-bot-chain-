// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title UsdcFaucet — 300 tUSDC per wallet every 24h, paid from pre-funded pool
contract UsdcFaucet {
    IERC20 public usdc;

    uint256 public constant CLAIM_AMOUNT = 300 * 1e6;
    uint256 public constant COOLDOWN = 24 hours;

    mapping(address => uint256) public lastClaimAt;

    event Claimed(address indexed user, uint256 amount);

    constructor(address usdcToken) {
        usdc = IERC20(usdcToken);
    }

    function claim() external {
        uint256 next = lastClaimAt[msg.sender] + COOLDOWN;
        require(block.timestamp >= next, "Claim again in 24 hours");
        require(usdc.balanceOf(address(this)) >= CLAIM_AMOUNT, "Faucet pool empty");
        lastClaimAt[msg.sender] = block.timestamp;
        require(usdc.transfer(msg.sender, CLAIM_AMOUNT), "Transfer failed");
        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }

    function poolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function canClaim(address user) external view returns (bool ready, uint256 nextClaimAt) {
        nextClaimAt = lastClaimAt[user] + COOLDOWN;
        ready = block.timestamp >= nextClaimAt && usdc.balanceOf(address(this)) >= CLAIM_AMOUNT;
    }

    function timeUntilClaim(address user) external view returns (uint256) {
        uint256 next = lastClaimAt[user] + COOLDOWN;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }
}
