import { findDir } from '../utils';
import { SET_BLOCK_TRACKING } from '../runtimeHelpers';
export const transformOnce = (node, context) => {
    if (node.type === 1 /* ELEMENT */ && findDir(node, 'once', true)) {
        context.helper(SET_BLOCK_TRACKING);
        return () => {
            if (node.codegenNode) {
                node.codegenNode = context.cache(node.codegenNode, true /* isVNode */);
            }
        };
    }
};
