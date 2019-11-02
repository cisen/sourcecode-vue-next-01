import { isString } from '@vue/shared';
// AST Utilities ---------------------------------------------------------------
// Some expressions, e.g. sequence and conditional expressions, are never
// associated with template nodes, so their source locations are just a stub.
// Container types like CompoundExpression also don't need a real location.
export const locStub = {
    source: '',
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 }
};
export function createArrayExpression(elements, loc = locStub) {
    return {
        type: 16 /* JS_ARRAY_EXPRESSION */,
        loc,
        elements
    };
}
export function createObjectExpression(properties, loc = locStub) {
    return {
        type: 14 /* JS_OBJECT_EXPRESSION */,
        loc,
        properties
    };
}
export function createObjectProperty(key, value) {
    return {
        type: 15 /* JS_PROPERTY */,
        loc: locStub,
        key: isString(key) ? createSimpleExpression(key, true) : key,
        value
    };
}
export function createSimpleExpression(content, isStatic, loc = locStub, isConstant = false) {
    return {
        type: 4 /* SIMPLE_EXPRESSION */,
        loc,
        isConstant,
        content,
        isStatic
    };
}
export function createInterpolation(content, loc) {
    return {
        type: 5 /* INTERPOLATION */,
        loc,
        content: isString(content)
            ? createSimpleExpression(content, false, loc)
            : content
    };
}
export function createCompoundExpression(children, loc = locStub) {
    return {
        type: 8 /* COMPOUND_EXPRESSION */,
        loc,
        children
    };
}
export function createCallExpression(callee, args = [], loc = locStub) {
    return {
        type: 13 /* JS_CALL_EXPRESSION */,
        loc,
        callee,
        arguments: args
    };
}
export function createFunctionExpression(params, returns, newline = false, loc = locStub) {
    return {
        type: 17 /* JS_FUNCTION_EXPRESSION */,
        params,
        returns,
        newline,
        loc
    };
}
export function createSequenceExpression(expressions) {
    return {
        type: 18 /* JS_SEQUENCE_EXPRESSION */,
        expressions,
        loc: locStub
    };
}
export function createConditionalExpression(test, consequent, alternate) {
    return {
        type: 19 /* JS_CONDITIONAL_EXPRESSION */,
        test,
        consequent,
        alternate,
        loc: locStub
    };
}
export function createCacheExpression(index, value, isVNode = false) {
    return {
        type: 20 /* JS_CACHE_EXPRESSION */,
        index,
        value,
        isVNode,
        loc: locStub
    };
}
