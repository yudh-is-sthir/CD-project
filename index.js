const esprima = require("esprima");

function generateSIL(ast) {
  const silCode = [];
  let labelCounter = 0;

  function getNewLabel() {
    return `t${labelCounter++}`;
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
        // Process left and right expressions first
        const left = visit(node.left);
        const right = visit(node.right);

        // Create a temporary variable for the result
        const tempVar = getNewLabel();

        // Generate SIL based on the operator
        switch (node.operator) {
          case "+":
            silCode.push(`add ${tempVar}, ${left}, ${right}`);
            break;
          case "-":
            silCode.push(`sub ${tempVar}, ${left}, ${right}`);
            break;
          case "*":
            silCode.push(`mul ${tempVar}, ${left}, ${right}`);
            break;
          case "/":
            silCode.push(`div ${tempVar}, ${left}, ${right}`);
            break;
          default:
            throw new Error(`Unhandled operator: ${node.operator}`);
        }

        return tempVar;

      case "AssignmentExpression":
        const target = visit(node.left);
        const value = visit(node.right);
        silCode.push(`mov ${target}, ${value}`);
        break;

      case "ExpressionStatement":
        visit(node.expression);
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
  const labelToIndent = {};

  const addLine = (line) => {
    pythonCode.push("    ".repeat(indentLevel) + line);
  };

  silCode.split("\n").forEach((line) => {
    const tokens = line.trim().split(" ");
    if (!tokens[0]) return;
    const op = tokens[0];

    switch (op) {
      case "decl":
        // Variable declaration
        break;

      case "mov":
        // Assignment
        addLine(`${tokens[1].split(",").filter((ele) => ele)} = ${tokens[2]}`);
        break;

      case "add":
      case "sub":
      case "mul":
      case "div":
        // Arithmetic operations
        const operator = { add: "+", sub: "-", mul: "*", div: "/" }[op];
        addLine(
          `${tokens[1].split(",").filter((ele) => ele)} = ${tokens[2]
            .split(",")
            .filter((ele) => ele)} ${operator} ${tokens[3]}`
        );
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
        // Conditional jump
        addLine(`# Jump to ${tokens[1]} if false`);
        indentLevel--;
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
        // Label definition
        const label = op.slice(0, -1);
        addLine(`# Label ${label}`);
        labelToIndent[label] = indentLevel;
        break;

      default:
        throw new Error(`Unhandled SIL operation: ${op}`);
    }
  });

  return pythonCode.join("\n");
}

function generateAST(code) {
  const ast = esprima.parseScript(code, { loc: false });
  return ast;
}

const code = `
    let a = 10;
    let b = 20;
    let c = 30;
    a = a * b + c / b - c;
`;

const ast = generateAST(code);
const sil = generateSIL(ast);
const pythonCode = translateSILtoPython(sil);

console.log(sil);
console.log("---------------------------");
console.log(pythonCode);
