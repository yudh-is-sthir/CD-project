const esprima = require('esprima');

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
console.log(generateSIL(ast));
