import { createCallExpression } from '../ast';
import { CREATE_TEXT } from '../runtimeHelpers';
import { PatchFlagNames } from '@vue/shared';
const isText = (node) => node.type === 5 /* INTERPOLATION */ || node.type === 2 /* TEXT */;
// Merge adjacent text nodes and expressions into a single expression
// e.g. <div>abc {{ d }} {{ e }}</div> should have a single expression node as child.
export const transformText = (node, context) => {
    if (node.type === 0 /* ROOT */ || node.type === 1 /* ELEMENT */) {
        // perform the transform on node exit so that all expressions have already
        // been processed.
        return () => {
            const children = node.children;
            let currentContainer = undefined;
            let hasText = false;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (isText(child)) {
                    hasText = true;
                    for (let j = i + 1; j < children.length; j++) {
                        const next = children[j];
                        if (isText(next)) {
                            if (!currentContainer) {
                                currentContainer = children[i] = {
                                    type: 8 /* COMPOUND_EXPRESSION */,
                                    loc: child.loc,
                                    children: [child]
                                };
                            }
                            // merge adjacent text node into current
                            currentContainer.children.push(` + `, next);
                            children.splice(j, 1);
                            j--;
                        }
                        else {
                            currentContainer = undefined;
                            break;
                        }
                    }
                }
            }
            if (hasText && children.length > 1) {
                // when an element has mixed text/element children, convert text nodes
                // into createTextVNode(text) calls.
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    if (isText(child) || child.type === 8 /* COMPOUND_EXPRESSION */) {
                        const callArgs = [];
                        // createTextVNode defaults to single whitespace, so if it is a
                        // single space the code could be an empty call to save bytes.
                        if (child.type !== 2 /* TEXT */ || child.content !== ' ') {
                            callArgs.push(child);
                        }
                        // mark dynamic text with flag so it gets patched inside a block
                        if (child.type !== 2 /* TEXT */) {
                            callArgs.push(`${1 /* TEXT */} /* ${PatchFlagNames[1 /* TEXT */]} */`);
                        }
                        children[i] = {
                            type: 12 /* TEXT_CALL */,
                            content: child,
                            loc: child.loc,
                            codegenNode: createCallExpression(context.helper(CREATE_TEXT), callArgs)
                        };
                    }
                }
            }
        };
    }
};
