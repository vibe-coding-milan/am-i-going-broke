const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { build } = require("../scripts/build-web.cjs");

test("frontend package is reproducible, complete and excludes server/private material", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aigb-web-build-"));
  try {
    const output = path.join(directory, "web");
    const files = build(output);
    assert.ok(files.includes("index.html"));
    assert.ok(files.includes("driveServiceClient.js"));
    for (const retired of ["assets/logo-full.svg", "assets/logo-full-light.svg", "assets/logo-text.svg", "assets/logo-text-light.svg"])
      assert.equal(files.includes(retired), false, "Ignored historical artwork must not enter the package");
    assert.ok(files.every(file => !/^(?:api|server|tests|docs|\.local-backups)\//.test(file) && !/\.(?:php|env|key|sqlite)$/.test(file)));
    const snapshot = files.map(file => fs.readFileSync(path.join(output, file)).toString("base64"));
    fs.writeFileSync(path.join(output, "stale.js"), "old build");
    assert.deepEqual(build(output), files);
    assert.equal(fs.existsSync(path.join(output, "stale.js")), false);
    assert.deepEqual(files.map(file => fs.readFileSync(path.join(output, file)).toString("base64")), snapshot);
    for (const match of fs.readFileSync(path.join(output, "index.html"), "utf8").matchAll(/(?:src|href)="\.\/([^"?#]+)[^"]*"/g)) {
      assert.ok(fs.existsSync(path.join(output, match[1])), "Packaged reference: " + match[1]);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
