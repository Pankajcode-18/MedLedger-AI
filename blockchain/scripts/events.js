/**
 * Shows the latest record and sharing events of the deployed HealthRecords contract.
 *   npm run chain:events:local      npm run chain:events:sepolia
 * Reads the address from blockchain/deployments/<network>.json (or HEALTH_RECORDS_CONTRACT_ADDRESS).
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  const file = path.join(__dirname, "..", "deployments", `${network}.json`);
  const address = process.env.HEALTH_RECORDS_CONTRACT_ADDRESS || (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, "utf8")).address);
  if (!address) throw new Error(`No deployment for ${network}. Run the deploy script first.`);
  const contract = await hre.ethers.getContractAt("HealthRecords", address);
  const latest = await hre.ethers.provider.getBlockNumber();
  const from = Math.max(0, latest - Number(process.env.EVENT_BLOCKS || 50000));
  const explorer = network === "sepolia" ? "https://sepolia.etherscan.io/tx/" : "";
  const rows = [];
  for (const name of ["RecordAdded", "AccessGranted", "AccessRevoked"]) {
    for (const e of await contract.queryFilter(contract.filters[name](), from, latest)) {
      rows.push({ block: e.blockNumber, event: name, patient: e.args[0], other: e.args[1], tx: e.transactionHash });
    }
  }
  // batches of records anchored under one Merkle root (CHAIN_BATCH_SIZE > 1)
  for (const e of await contract.queryFilter(contract.filters.BatchAnchored(), from, latest)) {
    rows.push({ block: e.blockNumber, event: "BatchAnchored", patient: `${e.args.count} records`, other: e.args.root, tx: e.transactionHash });
  }
  rows.sort((a, b) => a.block - b.block);
  console.log(`HealthRecords ${address} on ${network}: ${rows.length} events in the last ${latest - from} blocks`);
  for (const r of rows.slice(-25)) {
    console.log(`#${r.block}  ${r.event.padEnd(13)} ${r.event === "BatchAnchored" ? "" : "patient "}${r.patient}  ${r.event === "RecordAdded" ? "file" : r.event === "BatchAnchored" ? "root" : "doctor"} ${r.other}\n          ${explorer}${r.tx}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
