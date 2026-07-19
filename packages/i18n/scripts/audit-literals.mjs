import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(new URL("../../..", import.meta.url).pathname);
const targetDirs = [
  "apps/web/src",
  "apps/customer-mobile/src",
  "apps/provider-mobile/src",
  "apps/crew-mobile/src"
];
const auditedAttributes = new Set([
  "aria-label",
  "alt",
  "label",
  "placeholder",
  "title"
]);
const auditedPropertyNames = new Set([
  "body",
  "copy",
  "description",
  "emptyLabel",
  "eyebrow",
  "fallback",
  "heading",
  "label",
  "message",
  "note",
  "placeholder",
  "primaryLabel",
  "secondaryLabel",
  "subtitle",
  "text",
  "title"
]);
const auditedCallNames = new Set([
  "setAddressSearchMessage",
  "setError",
  "setErrorMessage",
  "setLocationGuidance",
  "setLockMessage",
  "setSearchMessage",
  "setSubmitGuidance"
]);
const ignoredFilePatterns = [
  /\/i18n(-client|-server)?\.ts$/,
  /\/lib\/api\.ts$/,
  /\/lib\/session\.ts$/,
  /\/lib\/tracking\.ts$/,
  /\/lib\/redirects\.ts$/,
  /\/providers\/ObservabilityProvider\.tsx$/,
  /\/StructuredData\.tsx$/
];

const findings = [];

for (const targetDir of targetDirs) {
  walk(path.join(root, targetDir));
}

for (const finding of findings.slice(0, 200)) {
  console.log(`${path.relative(root, finding.file)}:${finding.line}: ${finding.reason}: ${JSON.stringify(finding.value)}`);
}

if (findings.length > 0) {
  const countsByFile = new Map();
  for (const finding of findings) {
    const relativeFile = path.relative(root, finding.file);
    countsByFile.set(relativeFile, (countsByFile.get(relativeFile) ?? 0) + 1);
  }
  console.error("\nTop files by likely hardcoded UI strings:");
  for (const [file, count] of [...countsByFile.entries()].sort((left, right) => right[1] - left[1]).slice(0, 25)) {
    console.error(`${count.toString().padStart(4, " ")} ${file}`);
  }
  console.error(`Found ${findings.length} likely hardcoded UI strings. Move them into @yardmatch/i18n locale resources.`);
  process.exit(1);
}

console.log("No likely hardcoded UI strings found.");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    if (ignoredFilePatterns.some((pattern) => pattern.test(fullPath))) continue;
    const source = fs.readFileSync(fullPath, "utf8");
    const sourceFile = ts.createSourceFile(
      fullPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      entry.name.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    inspectNode(sourceFile, sourceFile, source);
  }
}

function inspectNode(sourceFile, node, source) {
  if (ts.isJsxText(node)) {
    const value = normalizeJsxText(node.getText(sourceFile));
    if (isLikelyCopy(value)) {
      addFinding(sourceFile, source, node, value, "jsx text");
    }
  }

  if (ts.isJsxAttribute(node)) {
    const name = node.name.getText(sourceFile);
    if (auditedAttributes.has(name) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text;
      if (isLikelyCopy(value)) {
        addFinding(sourceFile, source, node.initializer, value, `${name} attribute`);
      }
    }
  }

  if (ts.isPropertyAssignment(node)) {
    const name = propertyName(node.name, sourceFile);
    if (auditedPropertyNames.has(name) && isStringLike(node.initializer)) {
      const value = stringLikeValue(node.initializer);
      if (isLikelyCopy(value)) {
        addFinding(sourceFile, source, node.initializer, value, `${name} property`);
      }
    }
  }

  if (ts.isCallExpression(node)) {
    const expressionName = callExpressionName(node.expression, sourceFile);
    if (auditedCallNames.has(expressionName)) {
      for (const argument of node.arguments) {
        if (isStringLike(argument)) {
          const value = stringLikeValue(argument);
          if (isLikelyCopy(value)) {
            addFinding(sourceFile, source, argument, value, `${expressionName} call`);
          }
        }
      }
    }
  }

  ts.forEachChild(node, (child) => inspectNode(sourceFile, child, source));
}

function addFinding(sourceFile, source, node, value, reason) {
  const line = source.slice(0, node.getStart(sourceFile)).split("\n").length;
  findings.push({ file: sourceFile.fileName, line, value, reason });
}

function propertyName(name, sourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return name.getText(sourceFile);
}

function callExpressionName(expression, sourceFile) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  return expression.getText(sourceFile);
}

function isStringLike(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function stringLikeValue(node) {
  return node.text;
}

function normalizeJsxText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyCopy(value) {
  const trimmed = value.trim();
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (trimmed.length < 2) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return false;
  if (/^[@.#]/.test(trimmed)) return false;
  if (/^[a-z0-9_.:-]+$/.test(trimmed)) return false;
  if (/^[A-Z0-9_]+$/.test(trimmed)) return false;
  if (/^[a-z]+(?:-[a-z]+)+$/.test(trimmed)) return false;
  return true;
}
