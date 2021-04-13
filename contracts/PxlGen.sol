// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PxlGen is ERC1155, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _printIndexTracker;

    uint256 public constant TYPE_MASK = uint256(type(uint128).max) << 128;
    uint128 public constant INDEX_MASK = type(uint128).max;
    uint256 public constant PLOT_TOKEN_TYPE = 1 << 128;
    uint256 public constant PRINT_TOKEN_TYPE = 2 << 128;
    uint256 public constant MAX_PLOT_SUPPLY = 400;
    uint256 public constant MAX_PRINT_SUPPLY = 800;

    uint256 public constant startingPrice = 0.05 ether;

    string public baseURI;
    string public defaultURI; // ipfs directory with generated metadata
    mapping(uint256 => string) public tokenURIs;

    mapping(uint256 => bool) public isIndexMinted;

    mapping(uint256 => address) private _owners;

    event PlotMinted(address indexed to, uint256 id, uint256 indexed index, string uri);
    event PrintMinted(address indexed to, uint256 id, uint256 indexed index, string uri, string price);

    constructor(string memory _baseURI, string memory _defaultURI) ERC1155("") Ownable() {
        baseURI = _baseURI;
        defaultURI = _defaultURI;
    }

    function mintPlot(address to, uint256 index) external onlyOwner() {
        require(!isIndexMinted[index], "Plot already minted");
        require(index >= 1 && index <= MAX_PLOT_SUPPLY, "Invalid index");

        uint256 id = getPlotTokenID(index);
        _mint(to, id, 1, "");
        isIndexMinted[index] = true;

        emit PlotMinted(to, id, index, defaultURI);
    }

    function mintPrint(string calldata tokenURI) external payable {
        address to = _msgSender();
        require(_msgSender() != address(0), "no minting zero address");

        _printIndexTracker.increment();
        uint256 index = _printIndexTracker.current();
        uint256 id = getPrintTokenID(index);

        _mint(to, id, 1, "");

        tokenURIs[id] = tokenURI;

        emit PlotMinted(to, id, index, defaultURI);
    }

    function setBaseURI(string memory _baseURI) external onlyOwner() {
        baseURI = _baseURI;
    }

    // Tests:
    // - should return defaultURI + token index if no tokenURI is set
    // - should return tokenURI if it is set
    // - should return correct uri for given token type
    function uri(uint256 tokenId) public view override returns (string memory) {
        if (isPlotToken(tokenId)) {
            string memory ipfsHash = tokenURIs[tokenId];
            // if no tokenURI is set then return defaultURI.
            if (bytes(ipfsHash).length < 1) {
                return string(abi.encodePacked(baseURI, defaultURI, "/", toString(getTokenIndex(tokenId)), ".json"));
            }
            return string(abi.encodePacked(baseURI, tokenURIs[tokenId]));
        }
        return "";
    }

    function updateTokenURI(uint256 tokenId, string memory tokenURI) public {
        require(bytes(tokenURI).length > 0, "!valid tokenURI");
        require(isPlotToken(tokenId), "!PLOT_TOKEN_TYPE");
        require(balanceOf(_msgSender(), tokenId) == 1, "!owner");
        tokenURIs[tokenId] = tokenURI;
        emit URI(tokenURI, tokenId);
    }

    function isPlotToken(uint256 tokenId) public pure returns (bool) {
        return tokenId & TYPE_MASK == PLOT_TOKEN_TYPE;
    }

    function getTokenIndex(uint256 tokenId) public pure returns (uint256) {
        return tokenId & INDEX_MASK;
    }

    function getPlotTokenID(uint256 index) public pure returns (uint256) {
        return PLOT_TOKEN_TYPE + index;
    }

    function getPrintTokenID(uint256 index) public pure returns (uint256) {
        return PRINT_TOKEN_TYPE + index;
    }

    function printPrice(uint256 index) public pure returns (uint256) {
        return ((index**2) * startingPrice) / 100;
    }

    function getCoordinates(uint256 index) public pure returns (uint256, uint256) {
        require(index >= 1 && index <= MAX_PLOT_SUPPLY, "Invalid index");
        uint256 floor = (uint256(index) / 20) * 20;
        uint256 ceil = ((index + 20 - 1) / 20) * 20;
        uint256 x = index - floor;
        uint256 y = ceil / 20;
        if (x == 0) x = 20;
        return (x, y);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    function toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            _owners[id] = to;
        }
    }
}
