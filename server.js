const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const esprima = require("esprima");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Your existing SIL and Python translation functions
function generateSIL(ast) {
  const silCode = [];
  let labelCounter = 0;

  function getNewLabel() {
    return `L${labelCounter++}`;
  }

  function visit(node) {
    switch (node.type) {
      case "Program":
        node.body.forEach(visit);
        break;

      case "VariableDeclaration":
        node.declarations.forEach((decl) => visit(decl));
        break;

      case "VariableDeclarator":
        silCode.push(`decl ${node.id.name}`);
        if (node.init) {
          const value = visit(node.init);
          silCode.push(`mov ${node.id.name}, ${value}`);
        }
        break;

      case "Literal":
        return node.value;

      case "Identifier":
        return node.name;

      case "BinaryExpression":
        const left = visit(node.left);
        const right = visit(node.right);
        const tempVar = getNewLabel();
        const operatorMap = {
          "+": "add",
          "-": "sub",
          "*": "mul",
          "/": "div",
          ">": "gt",
          "<": "lt",
          ">=": "gte",
          "<=": "lte",
          "==": "eq",
          "!=": "neq",
        };
        const operator = operatorMap[node.operator];
        if (!operator) throw new Error(`Unhandled operator: ${node.operator}`);
        silCode.push(`${operator} ${tempVar}, ${left}, ${right}`);
        return tempVar;

      case "AssignmentExpression":
        const target = visit(node.left);
        const value = visit(node.right);
        silCode.push(`mov ${target}, ${value}`);
        break;

      case "ExpressionStatement":
        visit(node.expression);
        break;

      case "IfStatement":
        const test = visit(node.test);
        const elseLabel = getNewLabel();
        const endLabel = node.alternate ? getNewLabel() : null;

        silCode.push(`cmp ${test}`);
        silCode.push(`jmp_if_false ${elseLabel}`);
        visit(node.consequent);
        if (node.alternate) {
          silCode.push(`jmp ${endLabel}`);
          silCode.push(`${elseLabel}:`);
          visit(node.alternate);
          silCode.push(`${endLabel}:`);
        } else {
          silCode.push(`${elseLabel}:`);
        }
        break;

      case "WhileStatement":
        const loopStart = getNewLabel();
        const loopEnd = getNewLabel();

        silCode.push(`${loopStart}:`);
        const condition = visit(node.test);
        silCode.push(`cmp ${condition}`);
        silCode.push(`jmp_if_false ${loopEnd}`);
        visit(node.body);
        silCode.push(`jmp ${loopStart}`);
        silCode.push(`${loopEnd}:`);
        break;

      case "ForStatement":
        if (node.init) visit(node.init);
        const forStart = getNewLabel();
        const forEnd = getNewLabel();

        silCode.push(`${forStart}:`);
        if (node.test) {
          const testCondition = visit(node.test);
          silCode.push(`cmp ${testCondition}`);
          silCode.push(`jmp_if_false ${forEnd}`);
        }
        visit(node.body);
        if (node.update) visit(node.update);
        silCode.push(`jmp ${forStart}`);
        silCode.push(`${forEnd}:`);
        break;

      case "FunctionDeclaration":
        silCode.push(`func ${node.id.name}`);
        node.params.forEach((param) => {
          silCode.push(`param ${param.name}`);
        });
        visit(node.body);
        silCode.push(`endfunc`);
        break;

      case "ReturnStatement":
        if (node.argument) {
          const returnValue = visit(node.argument);
          silCode.push(`ret ${returnValue}`);
        } else {
          silCode.push(`ret`);
        }
        break;

      case "BlockStatement":
        node.body.forEach(visit);
        break;

      default:
        throw new Error(`Unhandled AST node type: ${node.type}`);
    }
  }

  visit(ast);
  return silCode.join("\n");
}

function translateSILtoPython(silCode) {
  const pythonCode = [];
  let indentLevel = 0;

  const addLine = (line) => {
    pythonCode.push("    ".repeat(indentLevel) + line);
  };

  silCode.split("\n").forEach((line) => {
    const tokens = line
      .trim()
      .split(" ")
      .filter((token) => token !== ","); // Remove stray commas
    if (!tokens[0]) return;
    const op = tokens[0];

    switch (op) {
      case "decl":
        // Variable declaration
        addLine(`${tokens[1]} = None`);
        break;

      case "mov":
        // Assignment
        addLine(`${tokens[1]} = ${tokens[2]}`);
        break;

      case "add":
      case "sub":
      case "mul":
      case "div":
        // Arithmetic operations
        const operator = { add: "+", sub: "-", mul: "*", div: "/" }[op];
        addLine(`${tokens[1]} = ${tokens[2]} ${operator} ${tokens[3]}`);
        break;

      case "lt":
      case "gt":
      case "lte":
      case "gte":
      case "eq":
      case "neq":
        // Comparison operations
        const compOperator = {
          lt: "<",
          gt: ">",
          lte: "<=",
          gte: ">=",
          eq: "==",
          neq: "!=",
        }[op];
        addLine(`${tokens[1]} = ${tokens[2]} ${compOperator} ${tokens[3]}`);
        break;

      case "cmp":
        // Comparison for conditional jumps
        addLine(`if not ${tokens[1]}:`);
        indentLevel++;
        break;

      case "jmp_if_false":
        // Conditional jump (false)
        indentLevel--;
        addLine(`# Jump to ${tokens[1]} if false`);
        break;

      case "jmp":
        // Unconditional jump
        addLine(`# Unconditional jump to ${tokens[1]}`);
        break;

      case "ret":
        // Return statement
        addLine(`return ${tokens[1] || ""}`.trim());
        break;

      case "L0:":
      case "L1:":
      case "L2:":
      case "L3:":
        // Label definition
        addLine(`# Label ${op.slice(0, -1)}`);
        break;

      default:
        throw new Error(`Unhandled SIL operation: ${op}`);
    }
  });

  // Add spacing for readability between blocks
  return pythonCode.join("\n").replace(/(\n\s*# Label .*\n)/g, "\n$1\n");
}

function translateSILtoCpp(silCode) {
  const cppCode = [];
  let indentLevel = 0;

  cppCode.push("#include <iostream>");
  cppCode.push("using namespace std;");
  cppCode.push("");

  cppCode.push("int main() {");
  indentLevel++;

  const addLine = (line) => {
    cppCode.push("    ".repeat(indentLevel) + line);
  };

  silCode.split("\n").forEach((line) => {
    const tokens = line
      .trim()
      .split(" ")
      .filter((token) => token !== ","); // Remove stray commas
    if (!tokens[0]) return;
    const op = tokens[0];

    switch (op) {
      case "decl":
        // Variable declaration
        addLine(`int ${tokens[1]};`);
        break;

      case "mov":
        // Assignment
        addLine(`${tokens[1]} = ${tokens[2]};`);
        break;

      case "add":
      case "sub":
      case "mul":
      case "div":
        // Arithmetic operations
        const operator = { add: "+", sub: "-", mul: "*", div: "/" }[op];
        addLine(`${tokens[1]} = ${tokens[2]} ${operator} ${tokens[3]};`);
        break;

      case "lt":
      case "gt":
      case "lte":
      case "gte":
      case "eq":
      case "neq":
        // Comparison operations
        const compOperator = {
          lt: "<",
          gt: ">",
          lte: "<=",
          gte: ">=",
          eq: "==",
          neq: "!=",
        }[op];
        addLine(`${tokens[1]} = ${tokens[2]} ${compOperator} ${tokens[3]};`);
        break;

      case "cmp":
        // Comparison for conditional jumps
        addLine(`if (!${tokens[1]}) {`);
        indentLevel++;
        break;

      case "jmp_if_false":
        // Conditional jump
        indentLevel--;
        addLine(`// Jump to ${tokens[1]} if false`);
        break;

      case "jmp":
        // Unconditional jump
        addLine(`// Unconditional jump to ${tokens[1]}`);
        break;

      case "ret":
        // Return statement
        addLine(`return ${tokens[1] || "0"};`.trim());
        break;

      case "L0:":
      case "L1:":
      case "L2:":
      case "L3:":
        // Label definition
        indentLevel--;
        addLine(`// Label ${op.slice(0, -1)}`);
        indentLevel++;
        break;

      default:
        throw new Error(`Unhandled SIL operation: ${op}`);
    }
  });

  indentLevel--;
  cppCode.push("    return 0;");
  cppCode.push("}");

  // Add spacing for readability between blocks
  return cppCode.join("\n").replace(/(\n\s*\/\/ Label .*\n)/g, "\n$1\n");
}

// API Endpoint for Translation
app.post("/translate", (req, res) => {
  const { code } = req.body;

  try {
    const ast = esprima.parseScript(code, { loc: false });
    const silCode = generateSIL(ast);
    const pythonCode = translateSILtoPython(silCode);
    const cppCode = translateSILtoCpp(silCode);

    res.json({ sil: silCode, python: pythonCode, cpp: cppCode });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
