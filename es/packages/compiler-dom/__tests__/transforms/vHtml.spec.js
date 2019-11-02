import { parse, transform } from '@vue/compiler-core';
import { transformVHtml } from '../../src/transforms/vHtml';
import { transformElement } from '../../../compiler-core/src/transforms/transformElement';
import { createObjectMatcher, genFlagText } from '../../../compiler-core/__tests__/testUtils';
function transformWithVHtml(template, options = {}) {
    const ast = parse(template);
    transform(ast, {
        nodeTransforms: [transformElement],
        directiveTransforms: {
            html: transformVHtml
        },
        ...options
    });
    return ast;
}
describe('compiler: v-html transform', () => {
    it('should convert v-html to innerHTML', () => {
        const ast = transformWithVHtml(`<div v-html="test"/>`);
        expect(ast.children[0].codegenNode).toMatchObject({
            arguments: [
                `"div"`,
                createObjectMatcher({
                    innerHTML: `[test]`
                }),
                `null`,
                genFlagText(8 /* PROPS */),
                `["innerHTML"]`
            ]
        });
    });
    it('should raise error and ignore children when v-html is present', () => {
        const onError = jest.fn();
        const ast = transformWithVHtml(`<div v-html="test">hello</div>`, {
            onError
        });
        expect(onError.mock.calls).toMatchObject([
            [{ code: 54 /* X_V_HTML_WITH_CHILDREN */ }]
        ]);
        expect(ast.children[0].codegenNode).toMatchObject({
            arguments: [
                `"div"`,
                createObjectMatcher({
                    innerHTML: `[test]`
                }),
                `null`,
                genFlagText(8 /* PROPS */),
                `["innerHTML"]`
            ]
        });
    });
    it('should raise error if has no expression', () => {
        const onError = jest.fn();
        transformWithVHtml(`<div v-html></div>`, {
            onError
        });
        expect(onError.mock.calls).toMatchObject([
            [{ code: 53 /* X_V_HTML_NO_EXPRESSION */ }]
        ]);
    });
});
