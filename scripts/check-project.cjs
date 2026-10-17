const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(root);
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" }).split("\0").filter(file => file && fs.existsSync(file));

function run(command, args, env = process.env) {
  execFileSync(command, args, { stdio: "inherit", env });
}

for (const file of files) {
  if (/\.(js|cjs)$/.test(file)) run(process.execPath, ["--check", file]);
  if (file.endsWith(".sh")) run("bash", ["-n", file]);
}

let linksChecked = 0;
const errors = [];
for (const file of files.filter(file => /\.(html|md)$/.test(file))) {
  const source = fs.readFileSync(file, "utf8");
  if (/\/Users\/[^\s)"<>]+|file:\/\//.test(source)) {
    errors.push(`${file}: contains a machine-specific file link`);
  }
  const references = file.endsWith(".md")
    ? [...source.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1])
    : [...source.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
    const target = reference.split(/[?#]/)[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!fs.existsSync(resolved)) errors.push(`${file}: missing link target ${target}`);
    linksChecked++;
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(`Syntax and ${linksChecked} local documentation/HTML link checks passed.`);

for (const TZ of ["America/New_York", "Pacific/Auckland"]) {
  console.log(`Scheduling regressions: ${TZ}`);
  run(process.execPath, ["--test", "tests/scheduling.test.cjs"], { ...process.env, TZ });
}
