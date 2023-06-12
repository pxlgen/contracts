// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract PxlGen is ERC1155, AccessControl {
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    bytes32 public constant PRINTER_ROLE = keccak256("PRINTER_ROLE");

    // Test

    // ============ Token Constants ============ //
    uint256 public constant TYPE_MASK = uint256(type(uint128).max) << 128;
    uint128 public constant INDEX_MASK = type(uint128).max;
    uint256 public constant PLOT_TOKEN_TYPE = 1 << 128;
    uint256 public constant PRINT_TOKEN_TYPE = 2 << 128;
    uint256 public constant MAX_PLOT_SUPPLY = 400;
    uint256 public constant MAX_PRINT_SUPPLY = 800;

    // ============ Metadata ============ //
    string public baseURI;
    string public defaultURI; // ipfs directory with generated metadata
    mapping(uint256 => string) public tokenURIs;

    // ============ Plot Token Vars ============ //
    mapping(uint256 => bool) public isIndexMinted;
    mapping(uint256 => address) private _owners;

    event PlotMinted(address indexed to, uint256 id, uint256 indexed index, string uri);
    event PrintMinted(address indexed to, uint256 id, uint256 indexed index, string uri, uint256 price);
    event PrintBurned(address indexed from, uint256 id, uint256 indexed index, uint256 price);

    constructor(string memory _baseURI, string memory _defaultURI) ERC1155("") {
        baseURI = _baseURI;
        defaultURI = _defaultURI;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ Minting/Burning Functions ============ //

    function mintPlot(address to, uint256 index) external {
        require(hasRole(FACTORY_ROLE, msg.sender), "!FACTORY_ROLE");
        require(!isIndexMinted[index], "Plot already minted");
        require(index >= 1 && index <= MAX_PLOT_SUPPLY, "Invalid index");

        uint256 id = getPlotTokenID(index);
        _mint(to, id, 1, "");
        isIndexMinted[index] = true;

        emit PlotMinted(to, id, index, defaultURI);
    }

    function mintPrint(
        address to,
        uint256 index,
        string calldata tokenURI,
        uint256 price
    ) external payable {
        require(hasRole(PRINTER_ROLE, msg.sender), "!PRINTER_ROLE");
        uint256 id = getPrintTokenID(index);
        tokenURIs[id] = tokenURI;
        _mint(to, id, 1, "");
        emit PrintMinted(to, id, index, tokenURI, price);
    }

    function burnPrint(
        address from,
        uint256 tokenId,
        uint256 price
    ) external {
        require(hasRole(PRINTER_ROLE, msg.sender), "!PRINTER_ROLE");
        require(balanceOf(from, tokenId) == 1, "!owner");
        require(isPrintToken(tokenId), "!PRINT_TOKEN_TYPE");
        _burn(from, tokenId, 1);
        emit PrintBurned(from, tokenId, getTokenIndex(tokenId), price);
    }

    // =========== Metadata Functions =========== //

    function setBaseURI(string memory _baseURI) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "!DEFAULT_ADMIN_ROLE");
        baseURI = _baseURI;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (isPlotToken(tokenId)) {
            string memory ipfsHash = tokenURIs[tokenId];
            // if no tokenURI is set then return defaultURI.
            if (bytes(ipfsHash).length < 1) {
                return string(abi.encodePacked(baseURI, defaultURI, "/", toString(getTokenIndex(tokenId)), ".json"));
            }
        }
        return string(abi.encodePacked(baseURI, tokenURIs[tokenId]));
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

    function isPrintToken(uint256 tokenId) public pure returns (bool) {
        return tokenId & TYPE_MASK == PRINT_TOKEN_TYPE;
    }

    function getTokenIndex(uint256 tokenId) public pure returns (uint256) {
        return tokenId & INDEX_MASK;
    }

    function getPlotTokenID(uint256 index) public pure returns (uint256) {
        return PLOT_TOKEN_TYPE + index;
    }

    function setFactory(address factory) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "!DEFAULT_ADMIN_ROLE");
        _setupRole(FACTORY_ROLE, factory);
    }

    function setPrinter(address printer) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "!DEFAULT_ADMIN_ROLE");
        _setupRole(PRINTER_ROLE, printer);
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
        require(owner != address(0), "owner query for nonexistent token");
        return owner;
    }

    function getPrintTokenID(uint256 index) public pure returns (uint256) {
        return PRINT_TOKEN_TYPE + index;
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

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
