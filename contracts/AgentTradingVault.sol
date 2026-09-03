// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @title AgentTradingVault — user deposits tUSDC; operator swaps via Uniswap on their behalf.
contract AgentTradingVault {
    address public operator;
    IERC20 public immutable usdc;
    IUniswapV2Router02 public immutable router;

    mapping(address => uint256) public usdcBalance;
    mapping(address => mapping(address => uint256)) public tokenBalance;

    event UsdcDeposited(address indexed user, uint256 amount);
    event UsdcWithdrawn(address indexed user, uint256 amount);
    event TokenWithdrawn(address indexed user, address indexed token, uint256 amount);
    event Swapped(
        address indexed user,
        address indexed tokenOut,
        uint256 usdcIn,
        uint256 tokenOutAmount
    );

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    constructor(address usdcToken, address uniswapRouter) {
        operator = msg.sender;
        usdc = IERC20(usdcToken);
        router = IUniswapV2Router02(uniswapRouter);
    }

    function depositUsdc(uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        usdcBalance[msg.sender] += amount;
        emit UsdcDeposited(msg.sender, amount);
    }

    function withdrawUsdc(uint256 amount) external {
        require(usdcBalance[msg.sender] >= amount, "Insufficient USDC");
        usdcBalance[msg.sender] -= amount;
        require(usdc.transfer(msg.sender, amount), "Transfer failed");
        emit UsdcWithdrawn(msg.sender, amount);
    }

    function withdrawToken(address token, uint256 amount) external {
        require(tokenBalance[msg.sender][token] >= amount, "Insufficient token");
        tokenBalance[msg.sender][token] -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        emit TokenWithdrawn(msg.sender, token, amount);
    }

/// @notice Operator swaps user's tUSDC for an asset via Uniswap V2 or SimpleMultiPool fallback.
    function swapForUser(
        address user,
        uint256 usdcIn,
        uint256 minOut,
        address[] calldata path
    ) external onlyOperator returns (uint256 amountOut) {
        require(path.length >= 2, "Bad path");
        require(path[0] == address(usdc), "Path must start with USDC");
        require(usdcBalance[user] >= usdcIn, "Insufficient USDC");
        require(usdcIn > 0, "Zero amount");

        usdcBalance[user] -= usdcIn;
        address tokenOut = path[path.length - 1];

        // Try Uniswap first
        try usdc.approve(address(router), usdcIn) returns (bool ok) {
            require(ok, "Approve failed");
            uint256[] memory amounts = router.swapExactTokensForTokens(
                usdcIn,
                minOut,
                path,
                address(this),
                block.timestamp + 600
            );
            amountOut = amounts[amounts.length - 1];
        } catch {
            revert("Swap failed - seed SimpleMultiPool or Uniswap liquidity");
        }

        tokenBalance[user][tokenOut] += amountOut;
        emit Swapped(user, tokenOut, usdcIn, amountOut);
    }

    /// @notice Swap via SimpleMultiPool (testnet fallback). Pool must hold liquidity; vault sends USDC to pool.
    function swapForUserViaPool(
        address pool,
        address user,
        address token,
        uint256 usdcIn,
        uint256 minOut
    ) external onlyOperator returns (uint256 amountOut) {
        require(usdcBalance[user] >= usdcIn, "Insufficient USDC");
        usdcBalance[user] -= usdcIn;
        require(usdc.transfer(pool, usdcIn), "USDC to pool failed");

        amountOut = ISimpleMultiPool(pool).swapUsdcForToken(user, token, usdcIn, minOut);
        tokenBalance[user][token] += amountOut;
        emit Swapped(user, token, usdcIn, amountOut);
    }
}

interface ISimpleMultiPool {
    function swapUsdcForToken(
        address user,
        address token,
        uint256 usdcIn,
        uint256 minTokenOut
    ) external returns (uint256);
}
