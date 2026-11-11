import path from "node:path";
import ts from "typescript";

const TRACKED_TABLES = new Set([
  "users",
  "events",
  "reimbursements",
  "fundDeposits",
  "fundRequests",
]);

const HELPERS = new Set([
  "insertTracked",
  "patchTracked",
  "replaceTracked",
  "deleteTracked",
]);

const WRITE_KINDS = new Set(["insert", "patch", "replace", "delete"]);

export type StorageWrite = {
  file: string;
  line: number;
  kind: "insert" | "patch" | "replace" | "delete";
  table: string;
};

function trackedTableFromType(type: ts.Type, checker: ts.TypeChecker): string | null {
  if (type.isUnion()) {
    for (const part of type.types) {
      const table = trackedTableFromType(part, checker);
      if (table) return table;
    }
    return null;
  }
  const alias = type.aliasSymbol?.getName();
  const aliasArg = type.aliasTypeArguments?.[0];
  if (alias === "Id" && aliasArg?.isStringLiteral() && TRACKED_TABLES.has(aliasArg.value)) {
    return aliasArg.value;
  }
  const text = checker.typeToString(type);
  const named = text.match(/^Id<"([^"]+)">$/);
  if (named && TRACKED_TABLES.has(named[1])) return named[1];
  const branded = text.match(/__tableName: "([^"]+)"/);
  if (branded && TRACKED_TABLES.has(branded[1])) return branded[1];
  return null;
}

function stringLiteral(node: ts.Expression, checker: ts.TypeChecker): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  const type = checker.getTypeAtLocation(node);
  return type.isStringLiteral() ? type.value : null;
}

function tableArg(node: ts.Expression, checker: ts.TypeChecker): string | null {
  const value = stringLiteral(node, checker);
  return value && TRACKED_TABLES.has(value) ? value : null;
}

function receiverTable(receiver: ts.Expression, checker: ts.TypeChecker): string | null {
  if (!ts.isCallExpression(receiver)) return null;
  if (!ts.isPropertyAccessExpression(receiver.expression)) return null;
  if (receiver.expression.name.text !== "table") return null;
  const arg = receiver.arguments[0];
  return arg ? tableArg(arg, checker) : null;
}

function helperName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)) &&
      current.name &&
      ts.isIdentifier(current.name)
    ) {
      return current.name.text;
    }
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.initializer &&
      (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))
    ) {
      return current.name.text;
    }
    current = current.parent;
  }
  return null;
}

function collectFile(program: ts.Program, fileName: string): StorageWrite[] {
  const source = program.getSourceFile(fileName);
  const checker = program.getTypeChecker();
  if (!source) return [];
  const writes: StorageWrite[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      WRITE_KINDS.has(node.expression.name.text) &&
      !HELPERS.has(helperName(node) ?? "")
    ) {
      const kind = node.expression.name.text as StorageWrite["kind"];
      const fromReceiver = receiverTable(node.expression.expression, checker);
      let table = fromReceiver;
      if (!table && node.arguments[0]) {
        if (kind === "insert") table = tableArg(node.arguments[0], checker);
        else if (kind === "patch" || kind === "replace") {
          table = tableArg(node.arguments[0], checker);
          if (!table) {
            table = trackedTableFromType(
              checker.getTypeAtLocation(node.arguments[0]),
              checker,
            );
          }
        } else {
          table = trackedTableFromType(
            checker.getTypeAtLocation(node.arguments[0]),
            checker,
          );
        }
      }
      if (table) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        writes.push({ file: fileName, line, kind, table });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return writes;
}

export function findDirectStorageWritesInText(text: string): StorageWrite[] {
  const fileName = "/virtual/storage-write.ts";
  const options: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    noEmit: true,
    skipLibCheck: true,
  };
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const host = ts.createCompilerHost(options);
  const readFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateSourceFile) => {
    if (name === fileName) return source;
    return readFile(name, languageVersion, onError, shouldCreateSourceFile);
  };
  const program = ts.createProgram([fileName], options, host);
  return collectFile(program, fileName);
}

export function findDirectStorageWrites(rootDir: string): StorageWrite[] {
  const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return [];
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(configPath),
  );
  const convexFiles = parsed.fileNames.filter((fileName) => {
    const name = fileName.replaceAll("\\", "/");
    return (
      name.includes("/convex/") &&
      !name.endsWith(".test.ts") &&
      !name.includes("/convex/_generated/")
    );
  });
  const program = ts.createProgram(convexFiles, parsed.options);
  const writes: StorageWrite[] = [];
  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile) continue;
    const fileName = source.fileName.replaceAll("\\", "/");
    if (!fileName.includes("/convex/")) continue;
    if (fileName.endsWith(".test.ts")) continue;
    if (fileName.includes("/convex/_generated/")) continue;
    writes.push(...collectFile(program, source.fileName));
  }
  return writes;
}
