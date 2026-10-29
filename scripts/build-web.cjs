const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entryFiles = [
  "index.html", "privacy.html", "terms.html", "styles.css", "app.js",
  "forecastCore.js", "planData.js", "planRepository.js", "browserPlatform.js", "driveServiceClient.js",
  "projectionHealth.js", "driveSync.js", "driveSyncUI.js",
  "assets/logo-icon.svg", "assets/logo-icon-light.svg",
  "assets/oauth-consent-logo.png", "assets/oauth-consent-logo-512.png",
  "components/projectionAnswer.js", "content/projectionAnswerCopy.js", "styles/projection-answer.css",
];

function frontendFiles() {
  const files = [...entryFiles];
  for (const file of files) {
    const stat = fs.lstatSync(path.join(root, file));
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Missing or unsafe frontend file: " + file);
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
