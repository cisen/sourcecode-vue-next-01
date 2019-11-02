import { locStub } from '../src';
import { CREATE_VNODE } from '../src/runtimeHelpers';
import { isString, PatchFlagNames, isArray } from '@vue/shared';
const leadingBracketRE = /^\[/;
const bracketsRE = /^\[|\]$/g;
// Create a matcher for an object
// where non-static expressions should be wrapped in []
// e.g.
// - createObjectMatcher({ 'foo': '[bar]' }) matches { foo: bar }
// - createObjectMatcher({ '[foo]': 'bar' }) matches { [foo]: "bar" }
export function createObjectMatcher(obj) {
    return {
        type: 14 /* JS_OBJECT_EXPRESSION */,
        properties: Object.keys(obj).map(key => ({
            type: 15 /* JS_PROPERTY */,
            key: {
                type: 4 /* SIMPLE_EXPRESSION */,
                content: key.replace(bracketsRE, ''),
                isStatic: !leadingBracketRE.test(key)
            },
            value: isString(obj[key])
                ? {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: obj[key].replace(bracketsRE, ''),
                    isStatic: !leadingBracketRE.test(obj[key])
                }
                : obj[key]
        }))
    };
}
export function createElementWithCodegen(args) {
    return {
        type: 1 /* ELEMENT */,
        loc: locStub,
        ns: 0 /* HTML */,
        tag: 'div',
        tagType: 0 /* ELEMENT */,
        isSelfClosing: false,
        props: [],
        children: [],
        codegenNode: {
            type: 13 /* JS_CALL_EXPRESSION */,
            loc: locStub,
            callee: CREATE_VNODE,
            arguments: args
        }
    };
}
export function genFlagText(flag) {
    if (isArray(flag)) {
        let f = 0;
        flag.forEach(ff => {
            f |= ff;
        });
        return `${f} /* ${flag.map(f => PatchFlagNames[f]).join(', ')} */`;
    }
    else {
        return `${flag} /* ${PatchFlagNames[flag]} */`;
    }
}
