// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Education} from "../src/Education.sol";
import {Registry} from "../src/Registry.sol";
import {IEducation} from "../src/interfaces/IEducation.sol";
import {BFNRoles} from "../src/base/BFNRoles.sol";

/// @title EducationBasicTest  
/// @notice Basic tests for Education contract implementation
contract EducationBasicTest is Test {
    Education public educationImpl;
    Registry public registryImpl;
    
    address public admin = makeAddr("admin");
    address public issuer = makeAddr("issuer");
    address public user = makeAddr("user");
    
    bytes32 public constant COURSE_ID = keccak256("financial-literacy-101");
    bytes32 public constant BADGE_ID = keccak256("early-adopter");
    bytes32 public constant ACHIEVEMENT_ID = keccak256("first-certificate");
    string public constant METADATA_HASH = "QmTestHash123";

    function setUp() public {
        // Deploy implementations
        educationImpl = new Education();
        registryImpl = new Registry();
    }

    function test_ContractDeployment() public {
        // Test that contracts can be deployed
        assertEq(address(educationImpl).code.length > 0, true);
        assertEq(address(registryImpl).code.length > 0, true);
    }

    function test_CertificateStructure() public {
        // Test the Certificate struct can be created
        IEducation.Certificate memory cert = IEducation.Certificate({
            id: 1,
            courseId: COURSE_ID,
            ipfsMetadataHash: METADATA_HASH,
            issuedAt: block.timestamp
        });
        
        assertEq(cert.id, 1);
        assertEq(cert.courseId, COURSE_ID);
        assertEq(cert.ipfsMetadataHash, METADATA_HASH);
        assertEq(cert.issuedAt, block.timestamp);
    }

    function test_ErrorDefinitions() public {
        // Test that custom errors can be properly encoded
        bytes memory emptyHashError = abi.encodeWithSelector(IEducation.EmptyMetadataHash.selector);
        bytes memory duplicateError = abi.encodeWithSelector(
            IEducation.CertificateAlreadyIssued.selector, 
            user, 
            COURSE_ID
        );
        bytes memory unauthorizedError = abi.encodeWithSelector(
            IEducation.UnauthorizedIssuer.selector, 
            user
        );
        
        assertGt(emptyHashError.length, 0);
        assertGt(duplicateError.length, 0);
        assertGt(unauthorizedError.length, 0);
    }

    function test_EventDefinitions() public {
        // Test that events can be properly defined
        vm.expectEmit(true, true, true, false);
        emit IEducation.CertificateIssued(user, 1, COURSE_ID);
        
        // Emit the actual event to test signature matching
        this.emitCertificateIssued(user, 1, COURSE_ID);
    }

    function emitCertificateIssued(address user_, uint256 certificateId, bytes32 courseId_) external {
        emit IEducation.CertificateIssued(user_, certificateId, courseId_);
    }
}