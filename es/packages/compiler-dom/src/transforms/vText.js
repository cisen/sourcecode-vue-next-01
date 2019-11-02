import { createObjectProperty, createSimpleExpression } from '@vue/compiler-core';
import { createDOMCompilerError } from '../errors';
export const transformVText = (dir, node, context) => {
    const { exp, loc } = dir;
    if (!exp) {
        context.onError(createDOMCompilerError(55 /* X_V_TEXT_NO_EXPRESSION */, loc));
    }
    if (node.children.length) {
        context.onError(createDOMCompilerError(56 /* X_V_TEXT_WITH_CHILDREN */, loc));
        node.children.length = 0;
    }
    return {
        props: [
            createObjectProperty(createSimpleExpression(`textContent`, true, loc), exp || createSimpleExpression('', true))
        ],
        needRuntime: false
    };
};
