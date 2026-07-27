const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const vendorDir = path.join(rootDir, "vendor");

const assets = [
  {
    from: path.join(rootDir, "node_modules", "chart.js", "dist", "chart.umd.js"),
    to: path.join(vendorDir, "chart.umd.js")
  },
  {
    from: path.join(rootDir, "node_modules", "xlsx", "dist", "xlsx.full.min.js"),
    to: path.join(vendorDir, "xlsx.full.min.js")
  }
];

fs.mkdirSync(vendorDir, { recursive: true });

for (const asset of assets) {
  if (!fs.existsSync(asset.from)) {
    throw new Error(`Missing asset: ${asset.from}. Run npm install first.`);
  }
  fs.copyFileSync(asset.from, asset.to);
}

console.log("Vendor assets prepared.");
