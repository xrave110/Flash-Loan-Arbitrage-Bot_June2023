// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <=0.8.19;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IArbitrageFinder.sol";
import "../lib/Arbitrage.sol";
import "./Whitelisted.sol";

contract ArbitrageFinder is IArbitrageFinder, Whitelisted {
    uint PRICE_TOLERANCE_PERCENT = 2;

    IUniswapV2Router02 private immutable uniswapRouter;
    address private immutable uniswapRouterAddr;

    IUniswapV2Router02 private immutable veloSwapRouter;
    address private immutable veloSwapRouterAddr;

    constructor(address _uniswapRouterAddress, address _veloSwapRouterAddress) {
        uniswapRouter = IUniswapV2Router02(_uniswapRouterAddress);
        uniswapRouterAddr = _uniswapRouterAddress;
        veloSwapRouter = IUniswapV2Router02(_veloSwapRouterAddress);
        veloSwapRouterAddr = _veloSwapRouterAddress;
    }

    function find(
        address token1,
        address token2
    )
        external
        view
        override
        onlyWhitelisted
        returns (bool, Arbitrage.Opportunity memory)
    {
        Arbitrage.Opportunity memory arbitrage;
        uint256 uniswapPrice = getUniswapPrice(token1, token2);
        uint256 veloswapPrice = getVeloSwapPrice(token1, token2);

        if (uniswapPrice > 0 && veloswapPrice > 0) {
            if (uniswapPrice > veloswapPrice) {
                if (isArbitrageEligible(uniswapPrice, veloswapPrice, 10)) {
                    arbitrage = Arbitrage.Opportunity(
                        Arbitrage.Transaction(
                            token1,
                            token2,
                            veloSwapRouterAddr,
                            10
                        ),
                        Arbitrage.Transaction(
                            token2,
                            token1,
                            uniswapRouterAddr,
                            0
                        )
                    );
                    return (true, arbitrage);
                }
            } else {
                if (isArbitrageEligible(veloswapPrice, uniswapPrice, 0)) {
                    arbitrage = Arbitrage.Opportunity(
                        Arbitrage.Transaction(
                            token1,
                            token2,
                            uniswapRouterAddr,
                            10
                        ),
                        Arbitrage.Transaction(
                            token2,
                            token1,
                            veloSwapRouterAddr,
                            0
                        )
                    );
                    return (true, arbitrage);
                }
            }
        }

        return (
            false,
            Arbitrage.Opportunity(
                Arbitrage.Transaction(address(0), address(0), address(0), 0),
                Arbitrage.Transaction(address(0), address(0), address(0), 0)
            )
        );
    }

    function getTokenPrice(
        address routerAddress,
        address token1,
        address token2
    ) private view returns (uint256) {
        IUniswapV2Router02 router = IUniswapV2Router02(routerAddress);
        address[] memory path = new address[](2);
        path[0] = token1;
        path[1] = token2;

        try router.getAmountsOut(1e18, path) returns (
            uint256[] memory amounts
        ) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function getEffectiveTokenBalance(
        address routerAddress,
        address token1,
        address token2
    ) private view returns (uint256) {
        IUniswapV2Router02 router = IUniswapV2Router02(routerAddress);
        IERC20 token = IERC20(token1);

        uint256 balance1 = token.balanceOf(address(router));
        uint256 balance2 = token.balanceOf(token2);

        return balance1 < balance2 ? balance1 : balance2;
    }

    function isArbitrageEligible(
        uint256 higherPrice,
        uint256 lowerPrice,
        uint256 tradeAmount
    ) private view returns (bool) {
        uint256 priceDifference = ((higherPrice - lowerPrice) * 10000) /
            lowerPrice; // Calculate the price difference as a percentage
        if (
            priceDifference >= PRICE_TOLERANCE_PERCENT * 100 && tradeAmount > 0
        ) {
            return true;
        }
        return false;
    }

    function getUniswapPrice(
        address token1,
        address token2
    ) private view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = token1;
        path[1] = token2;

        try uniswapRouter.getAmountsOut(1e18, path) returns (
            uint256[] memory amounts
        ) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function getVeloSwapPrice(
        address token1,
        address token2
    ) private view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = token1;
        path[1] = token2;

        try veloSwapRouter.getAmountsOut(1e18, path) returns (
            uint256[] memory amounts
        ) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }
}
