// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../lib/Arbitrage.sol";

interface IArbitrageExecutor {
    function execute(
        address tokenFrom,
        address tokenTo,
        address dex1,
        address dex2
    ) external;
}
