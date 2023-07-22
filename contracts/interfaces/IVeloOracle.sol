// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVeloOracle {
    function getManyRatesWithConnectors(
        uint8 src_len,
        IERC20[] memory connectors
    ) external view returns (uint256[] memory rates);
}
