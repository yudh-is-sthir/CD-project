<<<<<<< HEAD
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
=======
const esprima = require('esprima');

// Generate SIL from AST
function generateSIL(ast) {
    const silCode = [];
    let labelCounter = 0;

    function getNewLabel() {
        return `L${labelCounter++}`;
    }

    function visit(node) {
        switch (node.type) {
            case "Program":
                // Process all top-level statements
                node.body.forEach(visit);
                break;

            case "VariableDeclaration":
                // Handle variable declarations (e.g., let x = 5)
                node.declarations.forEach((decl) => visit(decl));
                break;

            case "VariableDeclarator":
                // Declare variables and optionally assign values
                silCode.push(`decl ${node.id.name}`);
                if (node.init) {
                    const value = visit(node.init);
                    silCode.push(`mov ${node.id.name}, ${value}`);
                }
                break;

            case "Literal":
                // Return the value of a literal (e.g., numbers, strings)
                return node.value;

            case "Identifier":
                // Return the name of the identifier
                return node.name;

            case "BinaryExpression":
                // Handle binary operations (e.g., x + y, x < y)
                const left = visit(node.left);
                const right = visit(node.right);
                const tempVar = getNewLabel();
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

                    // Comparison operators
                    case "<":
                        silCode.push(`lt ${tempVar}, ${left}, ${right}`);
                        break;
                    case ">":
                        silCode.push(`gt ${tempVar}, ${left}, ${right}`);
                        break;
                    case "<=":
                        silCode.push(`lte ${tempVar}, ${left}, ${right}`);
                        break;
                    case ">=":
                        silCode.push(`gte ${tempVar}, ${left}, ${right}`);
                        break;
                    case "==":
                        silCode.push(`eq ${tempVar}, ${left}, ${right}`);
                        break;
                    case "!=":
                        silCode.push(`neq ${tempVar}, ${left}, ${right}`);
                        break;

                    default:
                        throw new Error(`Unhandled operator: ${node.operator}`);
                }
                return tempVar;

            case "LogicalExpression":
                // Handle logical operations (&&, ||) with short-circuiting
                const left1 = visit(node.left);
                const result = getNewLabel();
                const shortCircuitLabel = getNewLabel();
                const endLabel1 = getNewLabel();

                if (node.operator === "&&") {
                    silCode.push(`cmp ${left1}`);
                    silCode.push(`jmp_if_false ${shortCircuitLabel}`);
                    const right = visit(node.right);
                    silCode.push(`mov ${result}, ${right}`);
                    silCode.push(`jmp ${endLabel1}`);
                    silCode.push(`${shortCircuitLabel}:`);
                    silCode.push(`mov ${result}, ${left1}`);
                    silCode.push(`${endLabel1}:`);
                } else if (node.operator === "||") {
                    silCode.push(`cmp ${left1}`);
                    silCode.push(`jmp_if_true ${shortCircuitLabel}`);
                    const right = visit(node.right);
                    silCode.push(`mov ${result}, ${right}`);
                    silCode.push(`jmp ${endLabel1}`);
                    silCode.push(`${shortCircuitLabel}:`);
                    silCode.push(`mov ${result}, ${left1}`);
                    silCode.push(`${endLabel1}:`);
                } else {
                    throw new Error(`Unhandled logical operator: ${node.operator}`);
                }
                return result;

            case "AssignmentExpression":
                // Handle assignments (e.g., x = y + 1)
                const target = visit(node.left);
                const value = visit(node.right);
                silCode.push(`mov ${target}, ${value}`);
                break;

            case "ExpressionStatement":
                // Process expressions (e.g., x = x + 1)
                visit(node.expression);
                break;

            case "BlockStatement":
                // Process a block of statements
                node.body.forEach(visit);
                break;

            case "IfStatement":
                // Handle if-else statements
                const condition = visit(node.test);
                const elseLabel = getNewLabel();
                const endLabel = node.alternate ? getNewLabel() : null;

                silCode.push(`cmp ${condition}`);
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
                // Handle while loops
                const loopStart = getNewLabel();
                const loopEnd = getNewLabel();

                silCode.push(`${loopStart}:`);
                const loopCondition = visit(node.test);
                silCode.push(`cmp ${loopCondition}`);
                silCode.push(`jmp_if_false ${loopEnd}`);
                visit(node.body);
                silCode.push(`jmp ${loopStart}`);
                silCode.push(`${loopEnd}:`);
                break;

            case "ForStatement":
                // Handle for loops
                if (node.init) visit(node.init);
                const forStart = getNewLabel();
                const forEnd = getNewLabel();

                silCode.push(`${forStart}:`);
                if (node.test) {
                    const forCondition = visit(node.test);
                    silCode.push(`cmp ${forCondition}`);
                    silCode.push(`jmp_if_false ${forEnd}`);
                }
                visit(node.body);
                if (node.update) visit(node.update);
                silCode.push(`jmp ${forStart}`);
                silCode.push(`${forEnd}:`);
                break;

            case "ReturnStatement":
                // Handle return statements
                if (node.argument) {
                    const returnValue = visit(node.argument);
                    silCode.push(`ret ${returnValue}`);
                } else {
                    silCode.push(`ret`);
                }
                break;

            default:
                throw new Error(`Unhandled AST node type: ${node.type}`);
        }
    }

    visit(ast);
    return silCode.join("\n");
}

// Generate AST from JavaScript code
function generateAST(code) {
    const ast = esprima.parseScript(code, { loc: false });
    return ast;
}

// Sample JavaScript code to generate SIL for
const code = `
    let a = 3;

    while (a < 10) {
        a = a + 1;
    }
`;

// Generate AST and SIL
const ast = generateAST(code);
console.log(generateSIL(ast));
>>>>>>> f11d80f30ee9bb790fedd67d1bfc57493d60fea4
