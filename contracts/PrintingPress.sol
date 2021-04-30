// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPxlGen.sol";
import "hardhat/console.sol";

contract PrintingPress is Ownable {
    IPxlGen public pxlGen;

    // ============ Print Stats ============ //
    uint256 public currentPrintIndex;
    uint256 public curvePool;
    uint256 public dividendPool;

    // ============ Dividends ============ //
    uint256 public lastDividendDate;
    uint256 public minimumPeriod = 30 days;
    struct Dividend {
        mapping(uint256 => bool) claimed;
        uint256 pool;
    }
    Dividend[] public dividends;
    mapping(uint256 => uint256) public dividendBalance;

    event DividendCreated(address indexed creator, uint256 pool);
    event DividendClaimed(uint256 indexed tokenId, uint256 dividendIndex, uint256 amount);
    event DividendClaimedBatch(uint256[] tokenIds, uint256[] dividendIndexes, uint256[] amount);

    constructor(IPxlGen _pxlgen) Ownable() {
        pxlGen = _pxlgen;
        lastDividendDate = block.timestamp;
    }

    function mintPrint(address to, string calldata tokenURI) external payable {
        require(to != address(0), "minting to zero address");

        currentPrintIndex += 1;
        uint256 price = printPrice(currentPrintIndex);
        require(msg.value >= price, "Insufficient funds");

        uint256 reserve = burnPrice(currentPrintIndex);
        curvePool += reserve;
        dividendPool += price - reserve;

        pxlGen.mintPrint(to, currentPrintIndex, tokenURI, price);
    }

    function burnPrint(uint256 tokenId) external {
        uint256 price = burnPrice(currentPrintIndex);
        pxlGen.burnPrint(_msgSender(), tokenId, price);
        curvePool -= price;
        currentPrintIndex -= 1;
        (bool success, ) = msg.sender.call{ value: price }("");
        require(success, "Transfer failed");
    }

    // =========== Dividends Functions =========== //

    function createDividend() external {
        require(block.timestamp > lastDividendDate + minimumPeriod, "!minimumPeriod");
        uint256 idx = dividends.length;
        dividends.push();
        Dividend storage d = dividends[idx];
        d.pool = dividendPool;
        dividendPool = 0;

        emit DividendCreated(_msgSender(), d.pool);
    }

    function dividendsToClaim(uint256 tokenId, uint256 idx) public view returns (uint256) {
        require(pxlGen.isPlotToken(tokenId), "!PLOT_TOKEN_TYPE");
        require(idx < dividends.length, "No such Dividend");
        Dividend storage d = dividends[idx];
        if (d.claimed[tokenId]) {
            return 0;
        }
        return d.pool / pxlGen.MAX_PLOT_SUPPLY();
    }

    function batchClaimDividend(uint256[] calldata tokenIds, uint256[] calldata idxs) external {
        uint256[] memory payouts = new uint256[](tokenIds.length);
        require(tokenIds.length == idxs.length, "tokenIds and idxs length mismatch");
        for (uint256 i = 0; i < idxs.length; i++) {
            uint256 index = idxs[i];
            uint256 tokenId = tokenIds[i];

            require(pxlGen.isPlotToken(tokenId), "!PLOT_TOKEN_TYPE");
            require(pxlGen.balanceOf(_msgSender(), tokenId) == 1, "!owner");
            require(index < dividends.length, "No such Dividend");

            Dividend storage d = dividends[index];
            require(!d.claimed[tokenId], "Already claimed");

            uint256 share = d.pool / pxlGen.MAX_PLOT_SUPPLY();
            d.claimed[tokenId] = true;
            dividendBalance[tokenId] += share;
            payouts[i] = share;
        }

        emit DividendClaimedBatch(tokenIds, idxs, payouts);
    }

    function claimDividend(uint256 tokenId, uint256 idx) public {
        require(pxlGen.isPlotToken(tokenId), "!PLOT_TOKEN_TYPE");
        require(pxlGen.balanceOf(_msgSender(), tokenId) == 1, "!owner");
        require(idx < dividends.length, "No such Dividend");

        Dividend storage d = dividends[idx];
        require(!d.claimed[tokenId], "Already claimed");

        uint256 share = d.pool / pxlGen.MAX_PLOT_SUPPLY();
        d.claimed[tokenId] = true;
        dividendBalance[tokenId] += share;

        emit DividendClaimed(tokenId, idx, share);
    }

    function hasClaimed(uint256 tokenId, uint256 idx) external view returns (bool) {
        require(idx < dividends.length, "No such Dividend");
        return dividends[idx].claimed[tokenId];
    }

    function printPrice(uint256 index) public pure returns (uint256) {
        return (index * 170) * 10**14;
    }

    function burnPrice(uint256 index) public pure returns (uint256 price) {
        price = (printPrice(index) * 90) / 100; // 90 % of print price
    }
}
