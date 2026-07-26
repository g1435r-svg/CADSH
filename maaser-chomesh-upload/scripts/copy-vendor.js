const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const vendorDir = path.join(root, "vendor");

fs.mkdirSync(vendorDir, { recursive: true });

const files = [
  ["node_modules/chart.js/dist/chart.umd.min.js", "vendor/chart.umd.min.js"],
  ["node_modules/xlsx/dist/xlsx.full.min.js", "vendor/xlsx.full.min.js"],
];

for (const [src, dest] of files) {
  const srcPath = path.join(root, src);
  const destPath = path.join(root, dest);
  fs.copyFileSync(srcPath, destPath);
  console.log(`copied: ${src} → ${dest}`);
}
