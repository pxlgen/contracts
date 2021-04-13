// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IFactory.sol";

contract OwnableDelegateProxy {}

contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}

interface IPxlGen {
    function mintPlot(address to, uint256 index) external;

    function isIndexMinted(uint256 index) external view returns (bool);
}

contract PxlGenFactory is IFactory, Ownable, ReentrancyGuard {
    IPxlGen public pxlGen;
    ProxyRegistry public proxyRegistry;
    string public baseMetadataURI;

    uint256 public constant NUM_OPTIONS = 400;
    mapping(uint256 => uint256) public optionToTokenID;

    constructor(
        address _proxyRegistryAddress,
        address _pxlGen,
        string memory _baseURI
    ) {
        proxyRegistry = ProxyRegistry(_proxyRegistryAddress);
        pxlGen = IPxlGen(_pxlGen);
        baseMetadataURI = _baseURI;
    }

    function name() external pure override returns (string memory) {
        return "PxlGen Pre-Sale";
    }

    function symbol() external pure override returns (string memory) {
        return "PXL";
    }

    function supportsFactoryInterface() external pure override returns (bool) {
        return true;
    }

    function factorySchemaName() external pure override returns (string memory) {
        return "ERC1155";
    }

    function numOptions() external pure override returns (uint256) {
        return NUM_OPTIONS;
    }

    function canMint(uint256 _index, uint256 _amount) external view override returns (bool) {
        return _canMint(msg.sender, _index, _amount);
    }

    function mint(
        uint256 _index,
        address _toAddress,
        uint256 _amount,
        bytes calldata _data
    ) external override nonReentrant() {
        return _mint(_index, _toAddress, _amount, _data);
    }

    function uri(uint256 _index) external view override returns (string memory) {
        return string(abi.encodePacked(baseMetadataURI, "/", toString(_index), ".json"));
    }

    function tokenURI(uint256 _index) external view returns (string memory) {
        return string(abi.encodePacked(baseMetadataURI, "/", toString(_index), ".json"));
    }

    function _mint(
        uint256 _index,
        address _to,
        uint256 _amount,
        bytes memory
    ) internal {
        require(_isOwnerOrProxy(msg.sender), "!authorised");
        require(_canMint(msg.sender, _index, _amount), "Already minted");
        pxlGen.mintPlot(_to, _index);
    }

    function balanceOf(address, uint256 _index) public view override returns (uint256) {
        bool isMinted = pxlGen.isIndexMinted(_index);
        // if isMinted then balance is 0 else there is 1 available
        return isMinted ? 0 : 1;
    }

    function safeTransferFrom(
        address,
        address _to,
        uint256 _index,
        uint256 _amount,
        bytes calldata _data
    ) external override {
        _mint(_index, _to, _amount, _data);
    }

    function isApprovedForAll(address _owner, address _operator) public view override returns (bool) {
        return owner() == _owner && _isOwnerOrProxy(_operator);
    }

    function _canMint(
        address,
        uint256 _index,
        uint256
    ) internal view returns (bool) {
        if (_index < 1 || _index > NUM_OPTIONS) return false;
        return !pxlGen.isIndexMinted(_index);
    }

    function _isOwnerOrProxy(address _address) internal view returns (bool) {
        return owner() == _address || address(proxyRegistry.proxies(owner())) == _address;
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
}
