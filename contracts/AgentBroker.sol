// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title AgentBroker — users trade with Test USDC; ETH is gas only.
contract AgentBroker {
    address public operator;
    IERC20 public usdc;

    mapping(address => uint256) public usdcBalance;
    mapping(address => mapping(address => uint256)) public position;
    mapping(address => mapping(address => uint256)) public costBasisUsdc;
    mapping(address => uint256) public reserved;

    event UsdcGranted(address indexed user, uint256 amount);
    event UsdcDeposited(address indexed user, uint256 amount);
    event AssetBought(
        address indexed user,
        address indexed token,
        uint256 tokenAmount,
        uint256 usdcCost
    );
    event AssetSold(
        address indexed user,
        address indexed token,
        uint256 tokenAmount,
        uint256 usdcProceeds
    );
    event AssetClaimed(address indexed user, address indexed token, uint256 amount);

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    constructor(address usdcToken) {
        operator = msg.sender;
        usdc = IERC20(usdcToken);
    }

    /// @notice App faucet — operator grants test USDC to user trading balance.
    function grantUsdc(address user, uint256 amount) external onlyOperator {
        require(amount > 0, "Zero amount");
        usdcBalance[user] += amount;
        emit UsdcGranted(user, amount);
    }

    /// @notice User deposits USDC from wallet into broker balance.
    function depositUsdc(uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );
        usdcBalance[msg.sender] += amount;
        emit UsdcDeposited(msg.sender, amount);
    }

    function withdrawUsdc(uint256 amount) external {
        require(usdcBalance[msg.sender] >= amount, "Insufficient balance");
        usdcBalance[msg.sender] -= amount;
        require(usdc.transfer(msg.sender, amount), "USDC transfer failed");
    }

    function buyAsset(
        address user,
        address token,
        uint256 tokenAmount,
        uint256 usdcCost
    ) external onlyOperator {
        require(tokenAmount > 0 && usdcCost > 0, "Zero amount");
        require(usdcBalance[user] >= usdcCost, "Insufficient USDC");
        uint256 available = IERC20(token).balanceOf(address(this)) - reserved[token];
        require(available >= tokenAmount, "Insufficient inventory");

        usdcBalance[user] -= usdcCost;
        position[user][token] += tokenAmount;
        costBasisUsdc[user][token] += usdcCost;
        reserved[token] += tokenAmount;

        emit AssetBought(user, token, tokenAmount, usdcCost);
    }

    function sellAsset(
        address user,
        address token,
        uint256 tokenAmount,
        uint256 usdcProceeds
    ) external onlyOperator {
        require(tokenAmount > 0 && usdcProceeds > 0, "Zero amount");
        uint256 held = position[user][token];
        require(held >= tokenAmount, "Insufficient position");

        uint256 basisReduction = (costBasisUsdc[user][token] * tokenAmount) / held;
        position[user][token] = held - tokenAmount;
        costBasisUsdc[user][token] -= basisReduction;
        reserved[token] -= tokenAmount;
        usdcBalance[user] += usdcProceeds;

        emit AssetSold(user, token, tokenAmount, usdcProceeds);
    }

    function claimAsset(address token, uint256 amount) external {
        uint256 held = position[msg.sender][token];
        require(held >= amount, "Insufficient position");

        uint256 basisReduction = (costBasisUsdc[msg.sender][token] * amount) / held;
        position[msg.sender][token] = held - amount;
        costBasisUsdc[msg.sender][token] -= basisReduction;
        reserved[token] -= amount;

        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        emit AssetClaimed(msg.sender, token, amount);
    }
}
