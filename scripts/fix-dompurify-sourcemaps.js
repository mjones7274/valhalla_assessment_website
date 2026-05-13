const fs = require("fs");
const path = require("path");

const targetFiles = [
  path.join(__dirname, "..", "node_modules", "dompurify", "dist", "purify.es.mjs"),
];

const sourceMapCommentPattern = /\n\/\/\# sourceMappingURL=.*$/m;

targetFiles.forEach((filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const currentContent = fs.readFileSync(filePath, "utf8");
  if (!sourceMapCommentPattern.test(currentContent)) {
    return;
  }

  const nextContent = currentContent.replace(sourceMapCommentPattern, "");
  fs.writeFileSync(filePath, nextContent, "utf8");
  console.log(`Patched DOMPurify sourcemap reference in ${path.relative(process.cwd(), filePath)}`);
});