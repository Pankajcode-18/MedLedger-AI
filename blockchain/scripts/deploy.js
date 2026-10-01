/**
 * Deploys HealthRecords and tells the MedLedger server where it is.
 *
 *   npm run chain:node          (terminal 1, local test chain)
 *   npm run deploy:local        (terminal 2)
 *   npm run deploy:sepolia      (needs SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY in the root .env,
 *                                and a little Sepolia test ETH on that account)
 *
 * Writes blockchain/deployments/<network>.json (address, ABI, transaction) and updates
 * apps/server/.env: HEALTH_RECORDS_CONTRACT_ADDRESS, WALLET_CHAIN_ID and, for the local chain,
 * CHAIN_RPC_URL + CHAIN_PRIVATE_KEY (Hardhat's public test account). For Sepolia you add
 * CHAIN_RPC_URL and CHAIN_PRIVATE_KEY yourself: the deploying account becomes the contract's relayer.
 * Set WRITE_SERVER_ENV=0 to leave apps/server/.env alone.
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Hardhat's first built-in account. Public knowledge – only ever holds local test ETH.
const HARDHAT_ACCOUNT_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function setEnv(file, values) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^#?\\s*${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, "\n")}${line}\n`;
  }
  fs.writeFileSync(file, text, "utf8");
}

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error(`No account for ${network}. Set SEPOLIA_PRIVATE_KEY in the root .env.`);
  const { chainId } = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deploying HealthRecords to ${network} (chain ${chainId}) from ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);
  if (balance === 0n) throw new Error("This account has no ETH to pay for the deployment. For Sepolia, use a faucet first.");

  const factory = await hre.ethers.getContractFactory("HealthRecords");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();

  const artifact = await hre.artifacts.readArtifact("HealthRecords");
  const details = {
    network,
    chainId: Number(chainId),
    address,
    relayer: deployer.address,
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
    explorer: Number(chainId) === 11155111 ? `https://sepolia.etherscan.io/address/${address}` : null,
    abi: artifact.abi,
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${network}.json`);
  fs.writeFileSync(out, JSON.stringify(details, null, 2));

  console.log(`\nHealthRecords deployed at ${address}`);
  console.log(`Transaction ${tx.hash} (block ${receipt.blockNumber})`);
  if (details.explorer) console.log(`View it: ${details.explorer}`);
  console.log(`Saved ${path.relative(process.cwd(), out)}`);

  if (process.env.WRITE_SERVER_ENV !== "0") {
    const envFile = path.join(__dirname, "..", "..", "apps", "server", ".env");
    const values = { HEALTH_RECORDS_CONTRACT_ADDRESS: address, WALLET_CHAIN_ID: String(chainId) };
    if (network === "localhost" || network === "hardhat") {
      Object.assign(values, { CHAIN_RPC_URL: "http://127.0.0.1:8545", CHAIN_PRIVATE_KEY: HARDHAT_ACCOUNT_0 });
    }
    setEnv(envFile, values);
    console.log(`Updated apps/server/.env (${Object.keys(values).join(", ")}). Restart the server to use the contract.`);
    if (network === "sepolia") {
      console.log("Also set CHAIN_RPC_URL and CHAIN_PRIVATE_KEY in apps/server/.env to this RPC URL and deploying account.");
    }
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error.message || error);
  process.exit(1);
});
