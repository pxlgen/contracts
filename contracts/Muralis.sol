// contracts/MyNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Muralis is ERC1155, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _cellIdTracker;
    Counters.Counter private _printIdTracker;

    uint256 public constant TYPE_MASK = uint256(type(uint128).max) << 128;
    uint128 public constant INDEX_MASK = type(uint128).max;
    uint256 public constant CELL_TOKEN_TYPE = 1 << 128;
    uint256 public constant PRINT_TOKEN_TYPE = 2 << 128;
    uint256 public constant MAX_CELL_SUPPLY = 400;
    uint256 public constant MAX_PRINT_SUPPLY = 800;

    string public baseURI;
    mapping(uint256 => string) public _tokenURIs;

    event CellMinted(address indexed to, uint256 indexed id, uint256 index, string tokenuri);

    constructor(string memory _baseURI) ERC1155("") {
        baseURI = _baseURI;
    }

    function setBaseURI(string memory _baseURI) external onlyOwner() {
        baseURI = _baseURI;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(baseURI, _tokenURIs[tokenId]));
    }

    // Tests
    // - Cannot mint more than MAX_CELL_SUPPLY
    // - Cannot mint to zero address
    // - Tokenuri gets set correctly
    function mintCell(string memory tokenURI) public payable {
        _cellIdTracker.increment();
        uint256 index = _cellIdTracker.current();
        require(index <= MAX_CELL_SUPPLY, "MAX_CELL_SUPPLY reached");

        uint256 id = CELL_TOKEN_TYPE + index;
        _mint(_msgSender(), id, 1, "");
        _tokenURIs[id] = tokenURI;
        emit CellMinted(_msgSender(), id, index, tokenURI);
    }

    // Tests
    // - Only owner can change token uri
    // - What if tokenId doesnt exist
    // - What if tokenuri is empty
    function updateTokenURI(uint256 tokenId, string memory tokenURI) public {
        require(balanceOf(_msgSender(), tokenId) == 1, "!owner");
        _tokenURIs[tokenId] = tokenURI;
        emit URI(tokenURI, tokenId);
    }
}
