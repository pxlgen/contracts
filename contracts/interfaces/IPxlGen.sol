// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPxlGen {
    function mintPrint(
        address to,
        uint256 index,
        string calldata tokenURI,
        uint256 price
    ) external payable;

    function burnPrint(
        address from,
        uint256 tokenId,
        uint256 price
    ) external;

    function balanceOf(address account, uint256 id) external view returns (uint256);

    function MAX_PLOT_SUPPLY() external view returns (uint256);

    function isPlotToken(uint256 tokenId) external pure returns (bool);
}
