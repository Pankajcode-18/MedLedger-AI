/**
 * Phase 10 – gas per call, before (the pre-Phase-10 contract, compiled here from docs/evaluation/gas)
 * and after (blockchain/contracts/HealthRecords.sol), on Hardhat's in-process chain.
 *   npx hardhat run docs/evaluation/eval_gas.js           (GAS_OUT=file.json to name the result)
 * Fees are shown at a few example gas prices; real Sepolia fees come from eval_sepolia.js.
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = hre;

function compileV1() {
  const source = fs.readFileSync(path.join(__dirname, "gas", "HealthRecordsV1.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "HealthRecordsV1.sol": { content: source } },
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const c = out.contracts["HealthRecordsV1.sol"].HealthRecordsV1;
  return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` };
}

const coder = ethers.AbiCoder.defaultAbiCoder();
const leafOf = (who, h) => ethers.keccak256(ethers.keccak256(coder.encode(["address", "bytes32"], [who, h])));
const pair = (a, b) => (BigInt(a) < BigInt(b) ? ethers.keccak256(ethers.concat([a, b])) : ethers.keccak256(ethers.concat([b, a])));
function rootOf(leaves) {
  let cur = leaves;
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? pair(cur[i], cur[i + 1]) : cur[i]);
    cur = next;
  }
  return cur[0];
}

const gasOf = async (txPromise) => Number((await (await txPromise).wait()).gasUsed);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
let counter = 0;
const newHash = () => ethers.keccak256(ethers.toUtf8Bytes(`report-${counter++}`));

async function measure(contract, signers, { batches }) {
  const [relayer, patient, doctor, other] = signers;
  const rows = {};
  const deployReceipt = await contract.deploymentTransaction().wait();
  rows.deploy = Number(deployReceipt.gasUsed);

  // 30 records for one patient: the first, and the median of the rest (the old array grows with each)
  const reg = [];
  for (let i = 0; i < 30; i++) reg.push(await gasOf(contract.connect(relayer).registerRecordFor(patient.address, newHash())));
  rows.registerRecordFor_first = reg[0];
  rows.registerRecordFor_median = median(reg.slice(1));
  rows.registerRecord_ownWallet = await gasOf(contract.connect(other).registerRecord(newHash()));
  rows.grantAccessFor = await gasOf(contract.connect(relayer).grantAccessFor(patient.address, doctor.address));
  rows.revokeAccessFor = await gasOf(contract.connect(relayer).revokeAccessFor(patient.address, doctor.address));
  rows.grantAccessFor_again = await gasOf(contract.connect(relayer).grantAccessFor(patient.address, doctor.address));
  rows.logAccess = await gasOf(contract.connect(doctor).logAccess(patient.address, "Viewed report"));
  if (batches) {
    rows.anchorBatch = {};
    for (const n of [1, 5, 10, 20, 50, 100, 500]) {
      const leaves = Array.from({ length: n }, () => leafOf(patient.address, newHash()));
      const g = await gasOf(contract.connect(relayer).anchorBatch(rootOf(leaves), n));
      rows.anchorBatch[n] = { total: g, perRecord: Math.round(g / n) };
    }
  }
  return rows;
}

async function main() {
  const signers = await ethers.getSigners();
  const v1 = compileV1();
  const before = await new ethers.ContractFactory(v1.abi, v1.bytecode, signers[0]).deploy();
  await before.waitForDeployment();
  const after = await (await ethers.getContractFactory("HealthRecords")).deploy();
  await after.waitForDeployment();

  const result = {
    note: "Gas used on Hardhat's in-process chain (solc 0.8.20, optimizer 200 runs, paris).",
    before: await measure(before, signers, { batches: false }),
    after: await measure(after, signers, { batches: true }),
  };
  // what a fee would be at example gas prices (Sepolia's real price is measured by eval_sepolia.js)
  const fee = (gas, gwei) => Number(ethers.formatEther(BigInt(gas) * ethers.parseUnits(String(gwei), "gwei")));
  result.feeEthAtExamplePrices = {};
  for (const gwei of [1, 10, 30]) {
    result.feeEthAtExamplePrices[`${gwei} gwei`] = {
      registerBefore: fee(result.before.registerRecordFor_median, gwei),
      registerAfter: fee(result.after.registerRecordFor_median, gwei),
      perRecordInBatchOf50: fee(result.after.anchorBatch[50].perRecord, gwei),
    };
  }
  const out = path.join(__dirname, "results", process.env.GAS_OUT || "gas_eval.json");
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  const b = result.before, a = result.after;
  const line = (k) => console.log(`${k.padEnd(28)} ${String(b[k] ?? "–").padStart(9)} ${String(a[k]).padStart(9)}`);
  console.log(`${"call".padEnd(28)} ${"before".padStart(9)} ${"after".padStart(9)}`);
  for (const k of ["deploy", "registerRecordFor_first", "registerRecordFor_median", "registerRecord_ownWallet", "grantAccessFor", "revokeAccessFor", "grantAccessFor_again", "logAccess"]) line(k);
  for (const [n, v] of Object.entries(a.anchorBatch)) console.log(`anchorBatch(${n})`.padEnd(28), String(v.total).padStart(19), ` = ${v.perRecord}/record`);
  console.log(`saved ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
