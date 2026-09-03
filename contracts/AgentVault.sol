// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentVault — stores agent allocation plans on Robinhood Chain testnet
contract AgentVault {
    address public owner;
    uint256 public planCount;

    struct AllocationPlan {
        address creator;
        uint256 totalAmount;
        uint256 createdAt;
        bool executed;
    }

    struct AllocationItem {
        string symbol;
        uint8 percent;
        uint256 amount;
        bool isCrypto;
    }

    mapping(uint256 => AllocationPlan) public plans;
    mapping(uint256 => AllocationItem[]) private planItems;

    event PlanCreated(uint256 indexed planId, address indexed creator, uint256 totalAmount);
    event PlanExecuted(uint256 indexed planId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createPlan(
        uint256 totalAmount,
        string[] calldata symbols,
        uint8[] calldata percents,
        uint256[] calldata amounts,
        bool[] calldata isCrypto
    ) external returns (uint256 planId) {
        require(symbols.length == percents.length, "Length mismatch");
        require(symbols.length == amounts.length, "Length mismatch");
        require(symbols.length == isCrypto.length, "Length mismatch");
        require(symbols.length > 0, "Empty plan");

        planId = planCount++;
        plans[planId] = AllocationPlan({
            creator: msg.sender,
            totalAmount: totalAmount,
            createdAt: block.timestamp,
            executed: false
        });

        for (uint256 i = 0; i < symbols.length; i++) {
            planItems[planId].push(
                AllocationItem({
                    symbol: symbols[i],
                    percent: percents[i],
                    amount: amounts[i],
                    isCrypto: isCrypto[i]
                })
            );
        }

        emit PlanCreated(planId, msg.sender, totalAmount);
    }

    function markExecuted(uint256 planId) external onlyOwner {
        require(planId < planCount, "Invalid plan");
        plans[planId].executed = true;
        emit PlanExecuted(planId);
    }

    function getPlanItemCount(uint256 planId) external view returns (uint256) {
        return planItems[planId].length;
    }

    function getPlanItem(uint256 planId, uint256 index)
        external
        view
        returns (string memory symbol, uint8 percent, uint256 amount, bool isCrypto)
    {
        AllocationItem memory item = planItems[planId][index];
        return (item.symbol, item.percent, item.amount, item.isCrypto);
    }
}
