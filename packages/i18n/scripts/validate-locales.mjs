import fs from "node:fs";
import path from "node:path";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

const packageRoot = path.resolve(new URL("..", import.meta.url).pathname);
const localesDir = path.join(packageRoot, "locales");
const sourceLocale = "en";
const targetLocales = ["es", "pseudo"];

function readLocale(locale) {
  return JSON.parse(fs.readFileSync(path.join(localesDir, `${locale}.json`), "utf8"));
}

function sortedKeys(messages) {
  return Object.keys(messages).sort();
}

function placeholders(value) {
  const names = new Set();
  const ast = parse(String(value), {
    ignoreTag: true
  });

  function visit(elements) {
    for (const element of elements) {
      if (
        element.type === TYPE.argument ||
        element.type === TYPE.number ||
        element.type === TYPE.date ||
        element.type === TYPE.time ||
        element.type === TYPE.select ||
        element.type === TYPE.plural
      ) {
        names.add(element.value);
      }

      if ((element.type === TYPE.select || element.type === TYPE.plural) && element.options) {
        for (const option of Object.values(element.options)) {
          visit(option.value);
        }
      }

      if (element.type === TYPE.tag && element.children) {
        visit(element.children);
      }
    }
  }

  visit(ast);
  return [...names].sort();
}

const sourceMessages = readLocale(sourceLocale);
const sourceKeys = sortedKeys(sourceMessages);
const errors = [];

for (const locale of targetLocales) {
  const messages = locale === "pseudo" ? { ...sourceMessages, ...readLocale(locale) } : readLocale(locale);
  const keys = sortedKeys(messages);
  const missing = sourceKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !sourceKeys.includes(key));

  if (missing.length > 0) {
    errors.push(`${locale} is missing ${missing.length} keys:\n${missing.join("\n")}`);
  }

  if (extra.length > 0) {
    errors.push(`${locale} has ${extra.length} orphaned keys:\n${extra.join("\n")}`);
  }

  for (const key of sourceKeys.filter((item) => item in messages)) {
    let sourcePlaceholders;
    let targetPlaceholders;

    try {
      sourcePlaceholders = placeholders(sourceMessages[key]).join(",");
    } catch (error) {
      errors.push(`${sourceLocale}:${key} has invalid ICU syntax (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }

    try {
      targetPlaceholders = placeholders(messages[key]).join(",");
    } catch (error) {
      errors.push(`${locale}:${key} has invalid ICU syntax (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }

    if (sourcePlaceholders !== targetPlaceholders) {
      errors.push(`${locale}:${key} placeholders differ (${targetPlaceholders || "none"} !== ${sourcePlaceholders || "none"})`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log(`Validated ${sourceKeys.length} i18n keys across ${[sourceLocale, ...targetLocales].join(", ")}.`);
