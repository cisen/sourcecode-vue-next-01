import { WITH_DIRECTIVES } from '../runtimeHelpers';
import { isString, isSymbol } from '@vue/shared';
import { isSlotOutlet, findProp } from '../utils';
export function hoistStatic(root, context) {
    walk(root.children, context, new Map(), isSingleElementRoot(root, root.children[0]));
}
export function isSingleElementRoot(root, child) {
    const { children } = root;
    return (children.length === 1 &&
        child.type === 1 /* ELEMENT */ &&
        !isSlotOutlet(child));
}
function walk(children, context, resultCache, doNotHoistNode = false) {
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        // only plain elements are eligible for hoisting.
        if (child.type === 1 /* ELEMENT */ &&
            child.tagType === 0 /* ELEMENT */) {
            if (!doNotHoistNode && isStaticNode(child, resultCache)) {
                // whole tree is static
                child.codegenNode = context.hoist(child.codegenNode);
                continue;
            }
            else {
                // node may contain dynamic children, but its props may be eligible for
                // hoisting.
                const codegenNode = child.codegenNode;
                if (codegenNode.type === 13 /* JS_CALL_EXPRESSION */) {
                    const flag = getPatchFlag(codegenNode);
                    if ((!flag ||
                        flag === 32 /* NEED_PATCH */ ||
                        flag === 1 /* TEXT */) &&
                        !hasDynamicKeyOrRef(child) &&
                        !hasCachedProps(child)) {
                        const props = getNodeProps(child);
                        if (props && props !== `null`) {
                            getVNodeCall(codegenNode).arguments[1] = context.hoist(props);
                        }
                    }
                }
            }
        }
        if (child.type === 1 /* ELEMENT */) {
            walk(child.children, context, resultCache);
        }
        else if (child.type === 11 /* FOR */) {
            // Do not hoist v-for single child because it has to be a block
            walk(child.children, context, resultCache, child.children.length === 1);
        }
        else if (child.type === 9 /* IF */) {
            for (let i = 0; i < child.branches.length; i++) {
                const branchChildren = child.branches[i].children;
                // Do not hoist v-if single child because it has to be a block
                walk(branchChildren, context, resultCache, branchChildren.length === 1);
            }
        }
    }
}
export function isStaticNode(node, resultCache = new Map()) {
    switch (node.type) {
        case 1 /* ELEMENT */:
            if (node.tagType !== 0 /* ELEMENT */) {
                return false;
            }
            const cached = resultCache.get(node);
            if (cached !== undefined) {
                return cached;
            }
            const codegenNode = node.codegenNode;
            if (codegenNode.type !== 13 /* JS_CALL_EXPRESSION */) {
                return false;
            }
            const flag = getPatchFlag(codegenNode);
            if (!flag && !hasDynamicKeyOrRef(node) && !hasCachedProps(node)) {
                // element self is static. check its children.
                for (let i = 0; i < node.children.length; i++) {
                    if (!isStaticNode(node.children[i], resultCache)) {
                        resultCache.set(node, false);
                        return false;
                    }
                }
                resultCache.set(node, true);
                return true;
            }
            else {
                resultCache.set(node, false);
                return false;
            }
        case 2 /* TEXT */:
        case 3 /* COMMENT */:
            return true;
        case 9 /* IF */:
        case 11 /* FOR */:
            return false;
        case 5 /* INTERPOLATION */:
        case 12 /* TEXT_CALL */:
            return isStaticNode(node.content, resultCache);
        case 4 /* SIMPLE_EXPRESSION */:
            return node.isConstant;
        case 8 /* COMPOUND_EXPRESSION */:
            return node.children.every(child => {
                return (isString(child) || isSymbol(child) || isStaticNode(child, resultCache));
            });
        default:
            if (__DEV__) {
                const exhaustiveCheck = node;
                exhaustiveCheck;
            }
            return false;
    }
}
function hasDynamicKeyOrRef(node) {
    return !!(findProp(node, 'key', true) || findProp(node, 'ref', true));
}
function hasCachedProps(node) {
    if (__BROWSER__) {
        return false;
    }
    const props = getNodeProps(node);
    if (props &&
        props !== 'null' &&
        props.type === 14 /* JS_OBJECT_EXPRESSION */) {
        const { properties } = props;
        for (let i = 0; i < properties.length; i++) {
            if (properties[i].value.type === 20 /* JS_CACHE_EXPRESSION */) {
                return true;
            }
        }
    }
    return false;
}
function getNodeProps(node) {
    const codegenNode = node.codegenNode;
    if (codegenNode.type === 13 /* JS_CALL_EXPRESSION */) {
        return getVNodeArgAt(codegenNode, 1);
    }
}
function getVNodeArgAt(node, index) {
    return getVNodeCall(node).arguments[index];
}
function getVNodeCall(node) {
    return node.callee === WITH_DIRECTIVES ? node.arguments[0] : node;
}
function getPatchFlag(node) {
    const flag = getVNodeArgAt(node, 3);
    return flag ? parseInt(flag, 10) : undefined;
}
