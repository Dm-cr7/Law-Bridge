const fs = require("fs");
const path = require("path");
const ttf2woff2 = require("ttf2woff2");

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".ttf"));

if (files.length === 0) {
  console.log("No .ttf files found in", dir);
  process.exit(0);
}

for (const f of files) {
  try {
    const inPath = path.join(dir, f);
    const buf = fs.readFileSync(inPath);
    const outBuf = ttf2woff2(buf);
    const outName = f.replace(/\.ttf$/i, ".woff2");
    const outPath = path.join(dir, outName);
    fs.writeFileSync(outPath, outBuf);
    console.log("Converted:", f, "->", outName);
  } catch (err) {
    console.error("Failed for", f, err && err.message ? err.message : err);
  }
}
