/**
 * Compile AgentTradingVault.sol with solc (requires solc npm package)
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "contracts/build");
mkdirSync(buildDir, { recursive: true });

try {
  execSync(
    `npx solcjs --optimize --bin -o "${buildDir}" "${join(root, "contracts/AgentTradingVault.sol")}" "${join(root, "contracts/SimpleMultiPool.sol")}"`,
    { stdio: "inherit", cwd: root }
  );
  console.log("Compiled vault + pool");
} catch {
  console.error("Install solc: npm install --save-dev solc");
  process.exit(1);
}
