import { createStructuralDirectiveTransform } from '../transform';
import { createSimpleExpression, createSequenceExpression, createCallExpression, createFunctionExpression, createObjectExpression, createObjectProperty } from '../ast';
import { createCompilerError } from '../errors';
import { getInnerRange, findProp, createBlockExpression, isTemplateNode, isSlotOutlet, injectProp } from '../utils';
import { RENDER_LIST, OPEN_BLOCK, CREATE_BLOCK, FRAGMENT, WITH_DIRECTIVES } from '../runtimeHelpers';
import { processExpression } from './transformExpression';
import { PatchFlagNames } from '@vue/shared';
export const transformFor = createStructuralDirectiveTransform('for', (node, dir, context) => {
    if (!dir.exp) {
        context.onError(createCompilerError(37 /* X_V_FOR_NO_EXPRESSION */, dir.loc));
        return;
    }
    const parseResult = parseForExpression(
    // can only be simple expression because vFor transform is applied
    // before expression transform.
    dir.exp, context);
    if (!parseResult) {
        context.onError(createCompilerError(38 /* X_V_FOR_MALFORMED_EXPRESSION */, dir.loc));
        return;
    }
    const { helper, addIdentifiers, removeIdentifiers, scopes } = context;
    const { source, value, key, index } = parseResult;
    // create the loop render function expression now, and add the
    // iterator on exit after all children have been traversed
    const renderExp = createCallExpression(helper(RENDER_LIST), [source]);
    const keyProp = findProp(node, `key`);
    const fragmentFlag = keyProp
        ? 64 /* KEYED_FRAGMENT */
        : 128 /* UNKEYED_FRAGMENT */;
    const codegenNode = createSequenceExpression([
        // fragment blocks disable tracking since they always diff their children
        createCallExpression(helper(OPEN_BLOCK), [`false`]),
        createCallExpression(helper(CREATE_BLOCK), [
            helper(FRAGMENT),
            `null`,
            renderExp,
            fragmentFlag + (__DEV__ ? ` /* ${PatchFlagNames[fragmentFlag]} */` : ``)
        ])
    ]);
    context.replaceNode({
        type: 11 /* FOR */,
        loc: dir.loc,
        source,
        valueAlias: value,
        keyAlias: key,
        objectIndexAlias: index,
        children: node.tagType === 3 /* TEMPLATE */ ? node.children : [node],
        codegenNode
    });
    // bookkeeping
    scopes.vFor++;
    if (!__BROWSER__ && context.prefixIdentifiers) {
        // scope management
        // inject identifiers to context
        value && addIdentifiers(value);
        key && addIdentifiers(key);
        index && addIdentifiers(index);
    }
    return () => {
        scopes.vFor--;
        if (!__BROWSER__ && context.prefixIdentifiers) {
            value && removeIdentifiers(value);
            key && removeIdentifiers(key);
            index && removeIdentifiers(index);
        }
        // finish the codegen now that all children have been traversed
        let childBlock;
        const isTemplate = isTemplateNode(node);
        const slotOutlet = isSlotOutlet(node)
            ? node
            : isTemplate &&
                node.children.length === 1 &&
                isSlotOutlet(node.children[0])
                ? node.children[0] // api-extractor somehow fails to infer this
                : null;
        const keyProperty = keyProp
            ? createObjectProperty(`key`, keyProp.type === 6 /* ATTRIBUTE */
                ? createSimpleExpression(keyProp.value.content, true)
                : keyProp.exp)
            : null;
        if (slotOutlet) {
            // <slot v-for="..."> or <template v-for="..."><slot/></template>
            childBlock = slotOutlet.codegenNode;
            if (isTemplate && keyProperty) {
                // <template v-for="..." :key="..."><slot/></template>
                // we need to inject the key to the renderSlot() call.
                // the props for renderSlot is passed as the 3rd argument.
                injectProp(childBlock, keyProperty, context);
            }
        }
        else if (isTemplate) {
            // <template v-for="...">
            // should generate a fragment block for each loop
            childBlock = createBlockExpression(createCallExpression(helper(CREATE_BLOCK), [
                helper(FRAGMENT),
                keyProperty ? createObjectExpression([keyProperty]) : `null`,
                node.children
            ]), context);
        }
        else {
            // Normal element v-for. Directly use the child's codegenNode
            // arguments, but replace createVNode() with createBlock()
            let codegenNode = node.codegenNode;
            if (codegenNode.callee === WITH_DIRECTIVES) {
                codegenNode.arguments[0].callee = helper(CREATE_BLOCK);
            }
            else {
                codegenNode.callee = helper(CREATE_BLOCK);
            }
            childBlock = createBlockExpression(codegenNode, context);
        }
        renderExp.arguments.push(createFunctionExpression(createForLoopParams(parseResult), childBlock, true /* force newline */));
    };
});
const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
// This regex doesn't cover the case if key or index aliases have destructuring,
// but those do not make sense in the first place, so this works in practice.
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
const stripParensRE = /^\(|\)$/g;
export function parseForExpression(input, context) {
    const loc = input.loc;
    const exp = input.content;
    const inMatch = exp.match(forAliasRE);
    if (!inMatch)
        return;
    const [, LHS, RHS] = inMatch;
    const result = {
        source: createAliasExpression(loc, RHS.trim(), exp.indexOf(RHS, LHS.length)),
        value: undefined,
        key: undefined,
        index: undefined
    };
    if (!__BROWSER__ && context.prefixIdentifiers) {
        result.source = processExpression(result.source, context);
    }
    let valueContent = LHS.trim()
        .replace(stripParensRE, '')
        .trim();
    const trimmedOffset = LHS.indexOf(valueContent);
    const iteratorMatch = valueContent.match(forIteratorRE);
    if (iteratorMatch) {
        valueContent = valueContent.replace(forIteratorRE, '').trim();
        const keyContent = iteratorMatch[1].trim();
        let keyOffset;
        if (keyContent) {
            keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length);
            result.key = createAliasExpression(loc, keyContent, keyOffset);
            if (!__BROWSER__ && context.prefixIdentifiers) {
                result.key = processExpression(result.key, context, true);
            }
        }
        if (iteratorMatch[2]) {
            const indexContent = iteratorMatch[2].trim();
            if (indexContent) {
                result.index = createAliasExpression(loc, indexContent, exp.indexOf(indexContent, result.key
                    ? keyOffset + keyContent.length
                    : trimmedOffset + valueContent.length));
                if (!__BROWSER__ && context.prefixIdentifiers) {
                    result.index = processExpression(result.index, context, true);
                }
            }
        }
    }
    if (valueContent) {
        result.value = createAliasExpression(loc, valueContent, trimmedOffset);
        if (!__BROWSER__ && context.prefixIdentifiers) {
            result.value = processExpression(result.value, context, true);
        }
    }
    return result;
}
function createAliasExpression(range, content, offset) {
    return createSimpleExpression(content, false, getInnerRange(range, offset, content.length));
}
export function createForLoopParams({ value, key, index }) {
    const params = [];
    if (value) {
        params.push(value);
    }
    if (key) {
        if (!value) {
            params.push(createSimpleExpression(`_`, false));
        }
        params.push(key);
    }
    if (index) {
        if (!key) {
            if (!value) {
                params.push(createSimpleExpression(`_`, false));
            }
            params.push(createSimpleExpression(`__`, false));
        }
        params.push(index);
    }
    return params;
}
