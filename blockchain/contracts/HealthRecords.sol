// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
 *
 * Cost (Phase 10): a record is one storage slot (owner and time packed together) plus the RecordAdded
 * event, which is what apps read to list a patient's records. The earlier per-patient array cost an
 * extra ~45k gas per record and only duplicated the events. For busy servers the relayer can instead
 * anchor one Merkle root for many records (anchorBatch); each record keeps its Merkle proof off-chain
 * and can still be checked on its own with verifyBatchedRecord.
 */
contract HealthRecords {
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

    mapping(address => mapping(address => bool)) private accessControl;

    /// @dev fileHash => owner address (low 160 bits) | timestamp (next 64 bits); 0 = not registered.
    mapping(bytes32 => uint256) private records;
    /// @dev Merkle root => timestamp (low 64 bits) | number of records in the batch (next 32 bits).
    mapping(bytes32 => uint256) private batches;

    // On-Chain Audit Trail Events
    event RecordAdded(address indexed patient, bytes32 indexed fileHash, uint256 timestamp);
    event AccessGranted(address indexed patient, address indexed doctor, uint256 timestamp);
    event AccessRevoked(address indexed patient, address indexed doctor, uint256 timestamp);
    event AccessLogged(address indexed patient, address indexed accessor, string action, uint256 timestamp);
    event BatchAnchored(bytes32 indexed root, uint256 count, uint256 timestamp);

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
        require(records[fileHash] == 0, "Record hash already registered");

        records[fileHash] = uint256(uint160(patient)) | (block.timestamp << 160);

        emit RecordAdded(patient, fileHash, block.timestamp);
    }

    /**
     * @notice Relayer anchors many records at once as the root of a Merkle tree.
     * Leaves are keccak256(bytes.concat(keccak256(abi.encode(patient, fileHash)))), pairs hashed in sorted order.
     * @param root Merkle root of the batch.
     * @param count Number of records in the batch (for the record history and audits).
     */
    function anchorBatch(bytes32 root, uint32 count) external onlyRelayer {
        require(root != bytes32(0), "Invalid batch root");
        require(count > 0, "Empty batch");
        require(batches[root] == 0, "Batch already anchored");

        batches[root] = block.timestamp | (uint256(count) << 64);

        emit BatchAnchored(root, count, block.timestamp);
    }

    /**
     * @notice Check one record inside an anchored batch with its Merkle proof.
     * @return bool True if the batch is anchored and the proof leads from this record to its root.
     */
    function verifyBatchedRecord(address patient, bytes32 fileHash, bytes32 root, bytes32[] calldata proof) external view returns (bool) {
        if (batches[root] == 0) return false;
        bytes32 node = keccak256(bytes.concat(keccak256(abi.encode(patient, fileHash))));
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            node = node < p ? keccak256(abi.encodePacked(node, p)) : keccak256(abi.encodePacked(p, node));
        }
        return node == root;
    }

    /// @notice When a batch was anchored and how many records it holds (0, 0 if unknown).
    function getBatchDetails(bytes32 root) external view returns (uint256 timestamp, uint256 count) {
        uint256 b = batches[root];
        return (uint64(b), uint32(b >> 64));
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
        return records[fileHash] != 0;
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
     * @notice Retrieve timestamp and owner details for a registered record.
     * @param fileHash SHA-256 hash of the record.
     * @return owner Address of the patient who registered the record.
     * @return timestamp Block timestamp when the record was anchored.
     */
    function getRecordDetails(bytes32 fileHash) external view returns (address owner, uint256 timestamp) {
        uint256 r = records[fileHash];
        require(r != 0, "Record does not exist");
        return (address(uint160(r)), r >> 160);
    }
}
