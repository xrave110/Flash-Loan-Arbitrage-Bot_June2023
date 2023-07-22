// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <=0.8.19;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ITradeExecutor.sol";
import "../interfaces/IArbitrageExecutor.sol";
import "./Whitelisted.sol";
import "../lib/Arbitrage.sol";
import "hardhat/console.sol";

contract ArbitrageExecutor is
    FlashLoanSimpleReceiverBase,
    Whitelisted,
    IArbitrageExecutor
{
    address payable owner;
    ITradeExecutor private immutable tradeExecutor;

    constructor(
        address _addressProvider,
        address executorAddress
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        tradeExecutor = ITradeExecutor(executorAddress);
    }

    function execute(
        address tokenFrom,
        address tokenTo,
        address dex1,
        address dex2
    ) external {
        address receiverAddress = address(this);
        uint16 referralCode = 0;

        bytes memory params = abi.encode(tokenFrom, tokenTo, dex1, dex2);

        console.log(tokenFrom);
        console.log(tokenTo);

        POOL.flashLoanSimple(
            receiverAddress,
            tokenFrom,
            10000000000,
            params,
            referralCode
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        (address tokenFrom, address tokenTo, address dex1, address dex2) = abi
            .decode(params, (address, address, address, address));
        uint256 _amount = 10000000000;

        IERC20(tokenFrom).approve(address(tradeExecutor), _amount);

        uint256 amountPurchased = tradeExecutor.executeTrade(
            dex1,
            tokenFrom,
            tokenTo,
            _amount
        );

        IERC20(tokenTo).approve(address(tradeExecutor), amountPurchased);

        tradeExecutor.executeTrade(dex2, tokenTo, tokenFrom, amountPurchased);

        uint256 totalAmount = amount + premium;
        IERC20(asset).approve(address(POOL), totalAmount);

        return true;
    }

    receive() external payable {}
}
