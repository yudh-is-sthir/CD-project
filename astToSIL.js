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
                const tempVar = `t${labelCounter++}`;
                silCode.push(`add ${tempVar}, ${left}, ${right}`);
                return tempVar;

            case "AssignmentExpression":
                const target = visit(node.left);
                const value = visit(node.right);
                silCode.push(`mov ${target}, ${value}`);
                break;

            case "ExpressionStatement":
                // Traverse the child expression
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



