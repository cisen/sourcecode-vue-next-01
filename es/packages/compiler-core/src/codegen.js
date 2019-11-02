import { advancePositionWithMutation, assert, isSimpleIdentifier, loadDep, toValidAssetId } from './utils';
import { isString, isArray, isSymbol } from '@vue/shared';
import { helperNameMap, TO_STRING, CREATE_VNODE, RESOLVE_COMPONENT, RESOLVE_DIRECTIVE, SET_BLOCK_TRACKING, CREATE_COMMENT } from './runtimeHelpers';
function createCodegenContext(ast, { mode = 'function', prefixIdentifiers = mode === 'module', sourceMap = false, filename = `template.vue.html` }) {
    const context = {
        mode,
        prefixIdentifiers,
        sourceMap,
        filename,
        source: ast.loc.source,
        code: ``,
        column: 1,
        line: 1,
        offset: 0,
        indentLevel: 0,
        // lazy require source-map implementation, only in non-browser builds!
        map: __BROWSER__ || !sourceMap
            ? undefined
            : new (loadDep('source-map')).SourceMapGenerator(),
        helper(key) {
            const name = helperNameMap[key];
            return prefixIdentifiers ? name : `_${name}`;
        },
        push(code, node, openOnly) {
            context.code += code;
            if (!__BROWSER__ && context.map) {
                if (node) {
                    let name;
                    if (node.type === 4 /* SIMPLE_EXPRESSION */ && !node.isStatic) {
                        const content = node.content.replace(/^_ctx\./, '');
                        if (content !== node.content && isSimpleIdentifier(content)) {
                            name = content;
                        }
                    }
                    addMapping(node.loc.start, name);
                }
                advancePositionWithMutation(context, code);
                if (node && !openOnly) {
                    addMapping(node.loc.end);
                }
            }
        },
        resetMapping(loc) {
            if (!__BROWSER__ && context.map) {
                addMapping(loc.start);
            }
        },
        indent() {
            newline(++context.indentLevel);
        },
        deindent(withoutNewLine = false) {
            if (withoutNewLine) {
                --context.indentLevel;
            }
            else {
                newline(--context.indentLevel);
            }
        },
        newline() {
            newline(context.indentLevel);
        }
    };
    function newline(n) {
        context.push('\n' + `  `.repeat(n));
    }
    function addMapping(loc, name) {
        context.map.addMapping({
            name,
            source: context.filename,
            original: {
                line: loc.line,
                column: loc.column - 1 // source-map column is 0 based
            },
            generated: {
                line: context.line,
                column: context.column - 1
            }
        });
    }
    if (!__BROWSER__ && context.map) {
        context.map.setSourceContent(filename, context.source);
    }
    return context;
}
export function generate(ast, options = {}) {
    const context = createCodegenContext(ast, options);
    const { mode, push, helper, prefixIdentifiers, indent, deindent, newline } = context;
    const hasHelpers = ast.helpers.length > 0;
    const useWithBlock = !prefixIdentifiers && mode !== 'module';
    // preambles
    if (mode === 'function') {
        // Generate const declaration for helpers
        // In prefix mode, we place the const declaration at top so it's done
        // only once; But if we not prefixing, we place the declaration inside the
        // with block so it doesn't incur the `in` check cost for every helper access.
        if (hasHelpers) {
            if (prefixIdentifiers) {
                push(`const { ${ast.helpers.map(helper).join(', ')} } = Vue\n`);
            }
            else {
                // "with" mode.
                // save Vue in a separate variable to avoid collision
                push(`const _Vue = Vue\n`);
                // in "with" mode, helpers are declared inside the with block to avoid
                // has check cost, but hoists are lifted out of the function - we need
                // to provide the helper here.
                if (ast.hoists.length) {
                    push(`const _${helperNameMap[CREATE_VNODE]} = Vue.${helperNameMap[CREATE_VNODE]}\n`);
                    if (ast.helpers.includes(CREATE_COMMENT)) {
                        push(`const _${helperNameMap[CREATE_COMMENT]} = Vue.${helperNameMap[CREATE_COMMENT]}\n`);
                    }
                }
            }
        }
        genHoists(ast.hoists, context);
        newline();
        push(`return `);
    }
    else {
        // generate import statements for helpers
        if (hasHelpers) {
            push(`import { ${ast.helpers.map(helper).join(', ')} } from "vue"\n`);
        }
        genHoists(ast.hoists, context);
        newline();
        push(`export default `);
    }
    // enter render function
    push(`function render() {`);
    indent();
    if (useWithBlock) {
        push(`with (this) {`);
        indent();
        // function mode const declarations should be inside with block
        // also they should be renamed to avoid collision with user properties
        if (hasHelpers) {
            push(`const { ${ast.helpers
                .map(s => `${helperNameMap[s]}: _${helperNameMap[s]}`)
                .join(', ')} } = _Vue`);
            newline();
            if (ast.cached > 0) {
                push(`const _cache = $cache`);
                newline();
            }
            newline();
        }
    }
    else {
        push(`const _ctx = this`);
        if (ast.cached > 0) {
            newline();
            push(`const _cache = _ctx.$cache`);
        }
        newline();
    }
    // generate asset resolution statements
    if (ast.components.length) {
        genAssets(ast.components, 'component', context);
    }
    if (ast.directives.length) {
        genAssets(ast.directives, 'directive', context);
    }
    if (ast.components.length || ast.directives.length) {
        newline();
    }
    // generate the VNode tree expression
    push(`return `);
    if (ast.codegenNode) {
        genNode(ast.codegenNode, context);
    }
    else {
        push(`null`);
    }
    if (useWithBlock) {
        deindent();
        push(`}`);
    }
    deindent();
    push(`}`);
    return {
        ast,
        code: context.code,
        map: context.map ? context.map.toJSON() : undefined
    };
}
function genAssets(assets, type, context) {
    const resolver = context.helper(type === 'component' ? RESOLVE_COMPONENT : RESOLVE_DIRECTIVE);
    for (let i = 0; i < assets.length; i++) {
        const id = assets[i];
        context.push(`const ${toValidAssetId(id, type)} = ${resolver}(${JSON.stringify(id)})`);
        context.newline();
    }
}
function genHoists(hoists, context) {
    if (!hoists.length) {
        return;
    }
    context.newline();
    hoists.forEach((exp, i) => {
        context.push(`const _hoisted_${i + 1} = `);
        genNode(exp, context);
        context.newline();
    });
}
function isText(n) {
    return (isString(n) ||
        n.type === 4 /* SIMPLE_EXPRESSION */ ||
        n.type === 2 /* TEXT */ ||
        n.type === 5 /* INTERPOLATION */ ||
        n.type === 8 /* COMPOUND_EXPRESSION */);
}
function genNodeListAsArray(nodes, context) {
    const multilines = nodes.length > 3 ||
        ((!__BROWSER__ || __DEV__) && nodes.some(n => isArray(n) || !isText(n)));
    context.push(`[`);
    multilines && context.indent();
    genNodeList(nodes, context, multilines);
    multilines && context.deindent();
    context.push(`]`);
}
function genNodeList(nodes, context, multilines = false) {
    const { push, newline } = context;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (isString(node)) {
            push(node);
        }
        else if (isArray(node)) {
            genNodeListAsArray(node, context);
        }
        else {
            genNode(node, context);
        }
        if (i < nodes.length - 1) {
            if (multilines) {
                push(',');
                newline();
            }
            else {
                push(', ');
            }
        }
    }
}
function genNode(node, context) {
    if (isString(node)) {
        context.push(node);
        return;
    }
    if (isSymbol(node)) {
        context.push(context.helper(node));
        return;
    }
    switch (node.type) {
        case 1 /* ELEMENT */:
        case 9 /* IF */:
        case 11 /* FOR */:
            __DEV__ &&
                assert(node.codegenNode != null, `Codegen node is missing for element/if/for node. ` +
                    `Apply appropriate transforms first.`);
            genNode(node.codegenNode, context);
            break;
        case 2 /* TEXT */:
            genText(node, context);
            break;
        case 4 /* SIMPLE_EXPRESSION */:
            genExpression(node, context);
            break;
        case 5 /* INTERPOLATION */:
            genInterpolation(node, context);
            break;
        case 12 /* TEXT_CALL */:
            genNode(node.codegenNode, context);
            break;
        case 8 /* COMPOUND_EXPRESSION */:
            genCompoundExpression(node, context);
            break;
        case 3 /* COMMENT */:
            genComment(node, context);
            break;
        case 13 /* JS_CALL_EXPRESSION */:
            genCallExpression(node, context);
            break;
        case 14 /* JS_OBJECT_EXPRESSION */:
            genObjectExpression(node, context);
            break;
        case 16 /* JS_ARRAY_EXPRESSION */:
            genArrayExpression(node, context);
            break;
        case 17 /* JS_FUNCTION_EXPRESSION */:
            genFunctionExpression(node, context);
            break;
        case 18 /* JS_SEQUENCE_EXPRESSION */:
            genSequenceExpression(node, context);
            break;
        case 19 /* JS_CONDITIONAL_EXPRESSION */:
            genConditionalExpression(node, context);
            break;
        case 20 /* JS_CACHE_EXPRESSION */:
            genCacheExpression(node, context);
            break;
        /* istanbul ignore next */
        default:
            if (__DEV__) {
                assert(false, `unhandled codegen node type: ${node.type}`);
                // make sure we exhaust all possible types
                const exhaustiveCheck = node;
                return exhaustiveCheck;
            }
    }
}
function genText(node, context) {
    context.push(JSON.stringify(node.content), node);
}
function genExpression(node, context) {
    const { content, isStatic } = node;
    context.push(isStatic ? JSON.stringify(content) : content, node);
}
function genInterpolation(node, context) {
    const { push, helper } = context;
    push(`${helper(TO_STRING)}(`);
    genNode(node.content, context);
    push(`)`);
}
function genCompoundExpression(node, context) {
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (isString(child)) {
            context.push(child);
        }
        else {
            genNode(child, context);
        }
    }
}
function genExpressionAsPropertyKey(node, context) {
    const { push } = context;
    if (node.type === 8 /* COMPOUND_EXPRESSION */) {
        push(`[`);
        genCompoundExpression(node, context);
        push(`]`);
    }
    else if (node.isStatic) {
        // only quote keys if necessary
        const text = isSimpleIdentifier(node.content)
            ? node.content
            : JSON.stringify(node.content);
        push(text, node);
    }
    else {
        push(`[${node.content}]`, node);
    }
}
function genComment(node, context) {
    if (__DEV__) {
        const { push, helper } = context;
        push(`${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`, node);
    }
}
// JavaScript
function genCallExpression(node, context) {
    const callee = isString(node.callee)
        ? node.callee
        : context.helper(node.callee);
    context.push(callee + `(`, node, true);
    genNodeList(node.arguments, context);
    context.push(`)`);
}
function genObjectExpression(node, context) {
    const { push, indent, deindent, newline, resetMapping } = context;
    const { properties } = node;
    if (!properties.length) {
        push(`{}`, node);
        return;
    }
    const multilines = properties.length > 1 ||
        ((!__BROWSER__ || __DEV__) &&
            properties.some(p => p.value.type !== 4 /* SIMPLE_EXPRESSION */));
    push(multilines ? `{` : `{ `);
    multilines && indent();
    for (let i = 0; i < properties.length; i++) {
        const { key, value, loc } = properties[i];
        resetMapping(loc); // reset source mapping for every property.
        // key
        genExpressionAsPropertyKey(key, context);
        push(`: `);
        // value
        genNode(value, context);
        if (i < properties.length - 1) {
            // will only reach this if it's multilines
            push(`,`);
            newline();
        }
    }
    multilines && deindent();
    const lastChar = context.code[context.code.length - 1];
    push(multilines || /[\])}]/.test(lastChar) ? `}` : ` }`);
}
function genArrayExpression(node, context) {
    genNodeListAsArray(node.elements, context);
}
function genFunctionExpression(node, context) {
    const { push, indent, deindent } = context;
    const { params, returns, newline } = node;
    push(`(`, node);
    if (isArray(params)) {
        genNodeList(params, context);
    }
    else if (params) {
        genNode(params, context);
    }
    push(`) => `);
    if (newline) {
        push(`{`);
        indent();
        push(`return `);
    }
    if (isArray(returns)) {
        genNodeListAsArray(returns, context);
    }
    else {
        genNode(returns, context);
    }
    if (newline) {
        deindent();
        push(`}`);
    }
}
function genConditionalExpression(node, context) {
    const { test, consequent, alternate } = node;
    const { push, indent, deindent, newline } = context;
    if (test.type === 4 /* SIMPLE_EXPRESSION */) {
        const needsParens = !isSimpleIdentifier(test.content);
        needsParens && push(`(`);
        genExpression(test, context);
        needsParens && push(`)`);
    }
    else {
        push(`(`);
        genCompoundExpression(test, context);
        push(`)`);
    }
    indent();
    context.indentLevel++;
    push(`? `);
    genNode(consequent, context);
    context.indentLevel--;
    newline();
    push(`: `);
    const isNested = alternate.type === 19 /* JS_CONDITIONAL_EXPRESSION */;
    if (!isNested) {
        context.indentLevel++;
    }
    genNode(alternate, context);
    if (!isNested) {
        context.indentLevel--;
    }
    deindent(true /* without newline */);
}
function genSequenceExpression(node, context) {
    context.push(`(`);
    genNodeList(node.expressions, context);
    context.push(`)`);
}
function genCacheExpression(node, context) {
    const { push, helper, indent, deindent, newline } = context;
    push(`_cache[${node.index}] || (`);
    if (node.isVNode) {
        indent();
        push(`${helper(SET_BLOCK_TRACKING)}(-1),`);
        newline();
    }
    push(`_cache[${node.index}] = `);
    genNode(node.value, context);
    if (node.isVNode) {
        push(`,`);
        newline();
        push(`${helper(SET_BLOCK_TRACKING)}(1),`);
        newline();
        push(`_cache[${node.index}]`);
        deindent();
    }
    push(`)`);
}
