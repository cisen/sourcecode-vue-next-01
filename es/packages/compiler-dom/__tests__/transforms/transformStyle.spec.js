import { parse, transform } from '@vue/compiler-core';
import { transformBind } from '../../../compiler-core/src/transforms/vBind';
import { transformElement } from '../../../compiler-core/src/transforms/transformElement';
import { transformStyle } from '../../src/transforms/transformStyle';
function transformWithStyleTransform(template, options = {}) {
    const ast = parse(template);
    transform(ast, {
        nodeTransforms: [transformStyle],
        ...options
    });
    return {
        root: ast,
        node: ast.children[0]
    };
}
describe('compiler: style transform', () => {
    test('should transform into directive node and hoist value', () => {
        const { root, node } = transformWithStyleTransform(`<div style="color: red"/>`);
        expect(root.hoists).toMatchObject([
            {
                type: 4 /* SIMPLE_EXPRESSION */,
                content: `{"color":"red"}`,
                isStatic: false
            }
        ]);
        expect(node.props[0]).toMatchObject({
            type: 7 /* DIRECTIVE */,
            name: `bind`,
            arg: {
                type: 4 /* SIMPLE_EXPRESSION */,
                content: `style`,
                isStatic: true
            },
            exp: {
                type: 4 /* SIMPLE_EXPRESSION */,
                content: `_hoisted_1`,
                isStatic: false
            }
        });
    });
    test('working with v-bind transform', () => {
        const { node } = transformWithStyleTransform(`<div style="color: red"/>`, {
            nodeTransforms: [transformStyle, transformElement],
            directiveTransforms: {
                bind: transformBind
            }
        });
        expect(node.codegenNode.arguments[1]).toMatchObject({
            type: 14 /* JS_OBJECT_EXPRESSION */,
            properties: [
                {
                    key: {
                        type: 4 /* SIMPLE_EXPRESSION */,
                        content: `style`,
                        isStatic: true
                    },
                    value: {
                        type: 4 /* SIMPLE_EXPRESSION */,
                        content: `_hoisted_1`,
                        isStatic: false
                    }
                }
            ]
        });
        // should not cause the STYLE patchFlag to be attached
        expect(node.codegenNode.arguments.length).toBe(2);
    });
});
