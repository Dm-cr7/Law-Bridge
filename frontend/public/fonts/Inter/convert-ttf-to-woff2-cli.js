const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const bin = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "ttf2woff2.cmd" : "ttf2woff2");

if (!fs.existsSync(bin)) {
  console.error("ttf2woff2 binary not found at", bin);
  console.error("Did you run `npm install ttf2woff2` in this folder?");
  process.exit(2);
}

const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".ttf"));

if (files.length === 0) {
  console.log("No .ttf files found in", dir);
  process.exit(0);
}

for (const f of files) {
  try {
    const inPath = path.join(dir, f);
    const outName = f.replace(/\.ttf$/i, ".woff2");
    const outPath = path.join(dir, outName);

    console.log("Converting:", f, "->", outName);

    const res = spawnSync(bin, [inPath], { encoding: "buffer", stdio: ["ignore", "pipe", "pipe"] });

    if (res.error) {
      throw res.error;
    }
    if (res.status !== 0) {
      const stderr = res.stderr && res.stderr.toString().trim();
      throw new Error("ttf2woff2 exited with code " + res.status + (stderr ? (": " + stderr) : ""));
    }

    fs.writeFileSync(outPath, res.stdout);
    const stats = fs.statSync(outPath);
    console.log("Wrote", outName, "-", stats.size, "bytes");
  } catch (err) {
    console.error("Failed for", f, err && err.message ? err.message : err);
  }
}