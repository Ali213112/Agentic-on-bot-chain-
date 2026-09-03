// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SimpleMultiPool — tUSDC ↔ ERC20 pools (x*y=k) for Robinhood testnet when Uniswap unavailable.
contract SimpleMultiPool {
    address public operator;
    address public vault;
    IERC20 public immutable usdc;

    mapping(address => uint256) public usdcReserve;
    mapping(address => uint256) public tokenReserve;

    event LiquidityAdded(address indexed token, uint256 usdcAmount, uint256 tokenAmount);
    event Swapped(address indexed user, address indexed token, uint256 usdcIn, uint256 tokenOut);

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    modifier onlySwapper() {
        require(msg.sender == operator || msg.sender == vault, "Not swapper");
        _;
    }

    function setVault(address vault_) external onlyOperator {
        require(vault == address(0), "Vault set");
        vault = vault_;
    }

    constructor(address usdcToken) {
        operator = msg.sender;
        usdc = IERC20(usdcToken);
    }

    function addLiquidity(
        address token,
        uint256 usdcAmount,
        uint256 tokenAmount
    ) external onlyOperator {
        require(usdc.transferFrom(msg.sender, address(this), usdcAmount), "USDC fail");
        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "Token fail");
        usdcReserve[token] += usdcAmount;
        tokenReserve[token] += tokenAmount;
        emit LiquidityAdded(token, usdcAmount, tokenAmount);
    }

    /// @notice Swap tUSDC for token; caller must be approved operator (vault).
    function swapUsdcForToken(
        address user,
        address token,
        uint256 usdcIn,
        uint256 minTokenOut
    ) external onlySwapper returns (uint256 tokenOut) {
        require(usdcIn > 0, "Zero in");
        uint256 u = usdcReserve[token];
        uint256 t = tokenReserve[token];
        require(u > 0 && t > 0, "No liquidity");

        tokenOut = (usdcIn * t) / (u + usdcIn);
        require(tokenOut >= minTokenOut, "Slippage");
        require(tokenOut <= t, "Insufficient token");

        usdcReserve[token] = u + usdcIn;
        tokenReserve[token] = t - tokenOut;

        require(IERC20(token).transfer(msg.sender, tokenOut), "Token out fail");
        emit Swapped(user, token, usdcIn, tokenOut);
    }

    function quoteUsdcForToken(address token, uint256 usdcIn) external view returns (uint256) {
        uint256 u = usdcReserve[token];
        uint256 t = tokenReserve[token];
        if (u == 0 || t == 0 || usdcIn == 0) return 0;
        return (usdcIn * t) / (u + usdcIn);
    }
}
