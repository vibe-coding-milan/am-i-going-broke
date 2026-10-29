const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entryFiles = [
  "index.html", "privacy.html", "terms.html", "styles.css", "app.js",
  "forecastCore.js", "planData.js", "planRepository.js", "browserPlatform.js", "driveServiceClient.js",
  "projectionHealth.js", "driveSync.js", "driveSyncUI.js",
];
const assetDirectories = ["assets", "components", "content", "styles"];
const allowedAsset = /\.(?:html|css|js|svg|png|jpe?g|webp|ico|woff2?)$/;

function frontendFiles() {
  const files = [...entryFiles];
  function visit(relative) {
    const source = path.join(root, relative);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error("Frontend assets cannot be symlinks: " + relative);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(source).sort()) visit(path.join(relative, name));
    } else if (allowedAsset.test(relative)) files.push(relative);
  }
  for (const directory of assetDirectories) visit(directory);
  for (const file of files) {
    if (!fs.lstatSync(path.join(root, file)).isFile()) throw new Error("Missing frontend file: " + file);
  }
  return files.sort();
}

function build(output = path.join(root, "dist")) {
  const files = frontendFiles();
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error("Build output cannot be a symlink");
  // This directory is generated output, never the source or the deployed PHP service.
  if (path.resolve(output) === root || root.startsWith(path.resolve(output) + path.sep)) throw new Error("Unsafe build output");
  fs.rmSync(output, { recursive: true, force: true });
  for (const relative of files) {
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, relative), destination);
  }
  return files;
}

if (require.main === module) console.log(`Built ${build().length} frontend files in dist/. PHP hosting/deployment is unchanged.`);
module.exports = { build, frontendFiles };
