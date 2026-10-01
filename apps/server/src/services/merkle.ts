import { ethers } from 'ethers';

/**
 * Merkle tree for anchoring many record fingerprints in one transaction (Phase 10).
 * Matches HealthRecords.verifyBatchedRecord: leaf = keccak256(keccak256(abi.encode(patient, fileHash))),
 * each pair hashed in sorted order, an odd node carried up unchanged.
 */
const coder = ethers.AbiCoder.defaultAbiCoder();

export const batchLeaf = (patient: string, fileHash: string): string =>
  ethers.keccak256(ethers.keccak256(coder.encode(['address', 'bytes32'], [patient, fileHash])));

const pair = (a: string, b: string): string => (BigInt(a) < BigInt(b) ? ethers.keccak256(ethers.concat([a, b])) : ethers.keccak256(ethers.concat([b, a])));

export function merkleTree(leaves: string[]): { root: string; proof: (i: number) => string[] } {
  if (!leaves.length) throw new Error('A batch needs at least one record');
  const levels: string[][] = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? pair(cur[i], cur[i + 1]) : cur[i]);
    levels.push(next);
  }
  return {
    root: levels[levels.length - 1][0],
    proof: (index: number) => {
      const out: string[] = [];
      let i = index;
      for (let l = 0; l < levels.length - 1; l++) {
        const sib = i ^ 1;
        if (sib < levels[l].length) out.push(levels[l][sib]);
        i = Math.floor(i / 2);
      }
      return out;
    }
  };
}

/** Recomputes the root from a leaf and its proof (the same steps as the contract). */
export const rootFromProof = (leaf: string, proof: string[]): string => proof.reduce((node, p) => pair(node, p), leaf);
