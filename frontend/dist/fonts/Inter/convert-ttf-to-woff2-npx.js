const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".ttf"));

if (files.length === 0) {
  console.log("No .ttf files found in", dir);
  process.exit(0);
}

for (const f of files) {
  const inPath = path.join(dir, f);
  const outName = f.replace(/\.ttf$/i, ".woff2");
  const outPath = path.join(dir, outName);
  console.log("Converting:", f, "->", outName);

  // Use npx so we avoid executing .bin paths directly (handles spaces in paths)
  const res = spawnSync("npx", ["--yes", "ttf2woff2", inPath], { encoding: "buffer", stdio: ["ignore", "pipe", "pipe"] });

  if (res.error) {
    console.error("Failed for", f, res.error && res.error.message ? res.error.message : res.error);
    continue;
  }
  if (res.status !== 0) {
    const stderr = res.stderr && res.stderr.toString().trim();
    console.error("ttf2woff2 failed for", f, "exit", res.status, stderr || "");
    continue;
  }

  try {
    fs.writeFileSync(outPath, res.stdout);
    const stats = fs.statSync(outPath);
    console.log("Wrote", outName, "-", stats.size, "bytes");
  } catch (err) {
    console.error("Write failed for", outName, err && err.message ? err.message : err);
  }
}