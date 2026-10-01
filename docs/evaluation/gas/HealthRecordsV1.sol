// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// The contract as it was before Phase 10, kept only so eval_gas.js can compare costs. Not deployed.

/**
 * @title HealthRecords
 * @dev Decentralized Electronic Health Records management on Ethereum Sepolia.
 * Handles patient record registration, granular physician access consent,
 * on-chain tamper verification, and immutable audit trails.
 *
 * Two ways to write:
 *  - A patient with their own wallet calls registerRecord / grantAccess / revokeAccess directly
 *    (msg.sender is the patient; MedLedger prepares the transaction and MetaMask signs it).
 *  - For patients without a wallet, the MedLedger server (the "relayer") records the same events
 *    on their behalf with registerRecordFor / grantAccessFor / revokeAccessFor. Only the relayer
 *    address set at deployment (or handed over with setRelayer) may call these.
 */
contract HealthRecordsV1 {
    /// @notice The MedLedger server account allowed to write on behalf of patients without a wallet.
    address public relayer;

    event RelayerChanged(address indexed previousRelayer, address indexed newRelayer);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only the MedLedger relayer");
        _;
    }

    constructor() {
        relayer = msg.sender;
        emit RelayerChanged(address(0), msg.sender);
    }

    /// @notice Hand the relayer role to another account (for example after rotating the server key).
    function setRelayer(address newRelayer) external onlyRelayer {
        require(newRelayer != address(0), "Invalid relayer address");
        emit RelayerChanged(relayer, newRelayer);
        relayer = newRelayer;
    }

    // Required Mappings
    mapping(address => bytes32[]) private patientRecords;
    mapping(address => mapping(address => bool)) private accessControl;

    // Supplementary state tracking for verification and audit
    mapping(bytes32 => address) private recordOwner;
    mapping(bytes32 => uint256) private recordTimestamp;
    mapping(bytes32 => bool) private recordExists;

    struct AuditLog {
        address accessor;
        address patient;
        string action;
        uint256 timestamp;
    }

    // On-Chain Audit Trail Events
    event RecordAdded(address indexed patient, bytes32 indexed fileHash, uint256 timestamp);
    event AccessGranted(address indexed patient, address indexed doctor, uint256 timestamp);
    event AccessRevoked(address indexed patient, address indexed doctor, uint256 timestamp);
    event AccessLogged(address indexed patient, address indexed accessor, string action, uint256 timestamp);

    /**
     * @notice Register a new health record SHA-256 hash mapped to msg.sender.
     * @param fileHash SHA-256 hash (bytes32) of the medical record/prescription document.
     */
    function registerRecord(bytes32 fileHash) external {
        _registerRecord(msg.sender, fileHash);
    }

    /// @notice Relayer registers a record hash for a patient who has no wallet.
    function registerRecordFor(address patient, bytes32 fileHash) external onlyRelayer {
        require(patient != address(0), "Invalid patient address");
        _registerRecord(patient, fileHash);
    }

    function _registerRecord(address patient, bytes32 fileHash) private {
        require(fileHash != bytes32(0), "Invalid record hash");
        require(!recordExists[fileHash], "Record hash already registered");

        patientRecords[patient].push(fileHash);
        recordOwner[fileHash] = patient;
        recordTimestamp[fileHash] = block.timestamp;
        recordExists[fileHash] = true;

        emit RecordAdded(patient, fileHash, block.timestamp);
    }

    /**
     * @notice Patient grants a doctor access to their health records.
     * @param doctor Ethereum address of the authorized physician.
     */
    function grantAccess(address doctor) external {
        _grantAccess(msg.sender, doctor);
    }

    /// @notice Relayer records a patient's decision (made in MedLedger) to share with a doctor.
    function grantAccessFor(address patient, address doctor) external onlyRelayer {
        require(patient != address(0), "Invalid patient address");
        _grantAccess(patient, doctor);
    }

    function _grantAccess(address patient, address doctor) private {
        require(doctor != address(0), "Invalid doctor address");
        require(doctor != patient, "Cannot grant access to self");

        accessControl[patient][doctor] = true;

        emit AccessGranted(patient, doctor, block.timestamp);
    }

    /**
     * @notice Patient revokes a doctor's access to their health records.
     * @param doctor Ethereum address of the physician to revoke.
     */
    function revokeAccess(address doctor) external {
        _revokeAccess(msg.sender, doctor);
    }

    /// @notice Relayer records a patient's decision (made in MedLedger) to stop sharing with a doctor.
    function revokeAccessFor(address patient, address doctor) external onlyRelayer {
        require(patient != address(0), "Invalid patient address");
        _revokeAccess(patient, doctor);
    }

    function _revokeAccess(address patient, address doctor) private {
        require(doctor != address(0), "Invalid doctor address");

        accessControl[patient][doctor] = false;

        emit AccessRevoked(patient, doctor, block.timestamp);
    }

    /**
     * @notice Check if a doctor has authorization to view a patient's records.
     * @param patient Ethereum address of the patient.
     * @param doctor Ethereum address of the physician.
     * @return bool True if authorized or if physician is the patient themselves.
     */
    function hasAccess(address patient, address doctor) external view returns (bool) {
        if (patient == doctor) {
            return true;
        }
        return accessControl[patient][doctor];
    }

    /**
     * @notice Verify whether a medical record hash exists on the immutable ledger (tamper detection).
     * @param fileHash SHA-256 hash (bytes32) to verify.
     * @return bool True if record is registered and authentic.
     */
    function verifyRecord(bytes32 fileHash) external view returns (bool) {
        return recordExists[fileHash];
    }

    /**
     * @notice Record an immutable audit log entry for access or review actions.
     * @param patient Ethereum address of the patient whose record was accessed.
     * @param action Human-readable description of the clinical action taken.
     */
    function logAccess(address patient, string calldata action) external {
        require(patient != address(0), "Invalid patient address");
        require(bytes(action).length > 0, "Action cannot be empty");

        emit AccessLogged(patient, msg.sender, action, block.timestamp);
    }

    /**
     * @notice Retrieve all record hashes for a patient.
     * @param patient Address of the patient.
     * @return bytes32[] Array of registered SHA-256 file hashes.
     */
    function getPatientRecords(address patient) external view returns (bytes32[] memory) {
        require(
            msg.sender == patient || accessControl[patient][msg.sender],
            "Access denied: Caller not authorized"
        );
        return patientRecords[patient];
    }

    /**
     * @notice Retrieve timestamp and owner details for a registered record.
     * @param fileHash SHA-256 hash of the record.
     * @return owner Address of the patient who registered the record.
     * @return timestamp Block timestamp when the record was anchored.
     */
    function getRecordDetails(bytes32 fileHash) external view returns (address owner, uint256 timestamp) {
        require(recordExists[fileHash], "Record does not exist");
        return (recordOwner[fileHash], recordTimestamp[fileHash]);
    }
}
