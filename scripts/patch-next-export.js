const fs = require("fs");
const path = require("path");

const targetPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "export",
  "index.js"
);

if (!fs.existsSync(targetPath)) {
  console.error("patch-next-export: target not found:", targetPath);
  process.exit(1);
}

let contents = fs.readFileSync(targetPath, "utf8");
if (contents.includes("function __sanitizeNextConfig")) {
  process.exit(0);
}

const helper = [
  "",
  "function __sanitizeNextConfig(nextConfig){",
  "  return JSON.parse(JSON.stringify(nextConfig, (k, v) => {",
  "    return typeof v === 'function' ? undefined : v;",
  "  }));",
  "}",
  ""
].join("\n");

// Insert helper after the first "use strict" header block.
if (!contents.includes("use strict")) {
  console.error("patch-next-export: unexpected file format");
  process.exit(1);
}

contents = contents.replace(
  /"use strict";\r?\n/,
  `"use strict";\n${helper}\n`
);

// Replace the exportPages payload to sanitize nextConfig (worker_threads safe).
const replacements = [
  {
    from: "renderOpts,",
    to: "renderOpts: __sanitizeNextConfig(renderOpts),"
  },
  {
    from: "options,",
    to: "options: __sanitizeNextConfig(options),"
  },
  {
    from: "nextConfig,",
    to: "nextConfig: __sanitizeNextConfig(nextConfig),"
  }
];

let replacedAny = false;
for (const { from, to } of replacements) {
  if (contents.includes(to)) continue;
  if (!contents.includes(from)) continue;
  contents = contents.replace(from, to);
  replacedAny = true;
}

if (!replacedAny) {
  console.error("patch-next-export: expected patterns not found");
  process.exit(1);
}

fs.writeFileSync(targetPath, contents, "utf8");
