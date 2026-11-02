const { execFileSync, spawnSync } = require("child_process");
const path = require("path");
const dotenv = require("dotenv");

const targets = {
  production: ".env.production",
  test: ".env.development-build",
};

function getCurrentBranch() {
  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  return execFileSync("git", ["branch", "--show-current"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  }).trim();
}

function getBuildTarget() {
  if (process.argv[2]) {
    return process.argv[2];
  }

  const branch = getCurrentBranch();
  if (branch === "main") {
    return "production";
  }
  if (branch === "development") {
    return "test";
  }

  throw new Error(
    `Cannot infer a build target from branch "${branch}". Run npm run build:production or npm run build:test.`
  );
}

const target = getBuildTarget();
const envFile = targets[target];

if (!envFile) {
  throw new Error(
    `Unknown build target "${target}". Expected one of: ${Object.keys(targets).join(", ")}.`
  );
}

const projectRoot = path.resolve(__dirname, "..");
const result = dotenv.config({
  path: path.join(projectRoot, envFile),
  override: true,
});

if (result.error) {
  throw result.error;
}

console.log(`Building ${target} using ${envFile}.`);

const build = spawnSync(
  process.execPath,
  [require.resolve("react-scripts/bin/react-scripts.js"), "build"],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  }
);

if (build.error) {
  throw build.error;
}

process.exit(build.status ?? 1);
