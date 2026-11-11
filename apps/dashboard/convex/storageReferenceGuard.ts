import path from "node:path";
import ts from "typescript";

const TRACKED_TABLES = new Set([
  "users",
  "events",
  "reimbursements",
  "fundDeposits",
  "fundRequests",
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

function bindingPropertyName(element: ts.BindingElement): string | null {
  if (element.propertyName && ts.isIdentifier(element.propertyName)) return element.propertyName.text;
  if (ts.isIdentifier(element.name)) return element.name.text;
  return null;
}

function isDbExpression(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  seen = new Set<ts.Node>(),
): boolean {
  if (seen.has(expr)) return false;
  seen.add(expr);
  if (ts.isPropertyAccessExpression(expr) && expr.name.text === "db") return true;
  if (!ts.isIdentifier(expr)) return false;
  const declaration = checker.getSymbolAtLocation(expr)?.valueDeclaration;
  if (!declaration) return false;
  if (ts.isBindingElement(declaration)) return bindingPropertyName(declaration) === "db";
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    return isDbExpression(declaration.initializer, checker, seen);
  }
  return false;
}

function boundWriteKind(node: ts.Identifier, checker: ts.TypeChecker): StorageWrite["kind"] | null {
  const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
  if (!declaration) return null;
  if (ts.isBindingElement(declaration)) {
    const propertyName = bindingPropertyName(declaration);
    if (!propertyName || !WRITE_KINDS.has(propertyName)) return null;
    const owner = declaration.parent.parent;
    if (
      ts.isVariableDeclaration(owner) &&
      owner.initializer &&
      isDbExpression(owner.initializer, checker)
    ) {
      return propertyName as StorageWrite["kind"];
    }
    return null;
  }
  if (
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer &&
    ts.isPropertyAccessExpression(declaration.initializer) &&
    WRITE_KINDS.has(declaration.initializer.name.text) &&
    isDbExpression(declaration.initializer.expression, checker)
  ) {
    return declaration.initializer.name.text as StorageWrite["kind"];
  }
  return null;
}

function calledWrite(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): { kind: StorageWrite["kind"]; receiver: ts.Expression | null } | null {
  if (ts.isPropertyAccessExpression(expression) && WRITE_KINDS.has(expression.name.text)) {
    return {
      kind: expression.name.text as StorageWrite["kind"],
      receiver: expression.expression,
    };
  }
  if (ts.isElementAccessExpression(expression)) {
    const argument = expression.argumentExpression;
    if (
      argument &&
      (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
      WRITE_KINDS.has(argument.text)
    ) {
      return {
        kind: argument.text as StorageWrite["kind"],
        receiver: expression.expression,
      };
    }
  }
  if (ts.isIdentifier(expression)) {
    const kind = boundWriteKind(expression, checker);
    if (kind) return { kind, receiver: null };
  }
  return null;
}

function collectFile(program: ts.Program, fileName: string): StorageWrite[] {
  const source = program.getSourceFile(fileName);
  const checker = program.getTypeChecker();
  if (!source) return [];
  const writes: StorageWrite[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const called = calledWrite(node.expression, checker);
      if (!called) {
        ts.forEachChild(node, visit);
        return;
      }
      const { kind } = called;
      const fromReceiver = called.receiver ? receiverTable(called.receiver, checker) : null;
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
