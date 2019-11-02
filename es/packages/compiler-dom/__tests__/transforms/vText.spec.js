import { parse, transform } from '@vue/compiler-core';
import { transformVText } from '../../src/transforms/vText';
import { transformElement } from '../../../compiler-core/src/transforms/transformElement';
import { createObjectMatcher, genFlagText } from '../../../compiler-core/__tests__/testUtils';
function transformWithVText(template, options = {}) {
    const ast = parse(template);
    transform(ast, {
        nodeTransforms: [transformElement],
        directiveTransforms: {
            text: transformVText
        },
        ...options
    });
    return ast;
}
describe('compiler: v-text transform', () => {
    it('should convert v-text to textContent', () => {
        const ast = transformWithVText(`<div v-text="test"/>`);
        expect(ast.children[0].codegenNode).toMatchObject({
            arguments: [
                `"div"`,
                createObjectMatcher({
                    textContent: `[test]`
                }),
                `null`,
                genFlagText(8 /* PROPS */),
                `["textContent"]`
            ]
        });
    });
    it('should raise error and ignore children when v-text is present', () => {
        const onError = jest.fn();
        const ast = transformWithVText(`<div v-text="test">hello</div>`, {
            onError
        });
        expect(onError.mock.calls).toMatchObject([
            [{ code: 56 /* X_V_TEXT_WITH_CHILDREN */ }]
        ]);
        expect(ast.children[0].codegenNode).toMatchObject({
            arguments: [
                `"div"`,
                createObjectMatcher({
                    textContent: `[test]`
                }),
                `null`,
                genFlagText(8 /* PROPS */),
                `["textContent"]`
            ]
        });
    });
    it('should raise error if has no expression', () => {
        const onError = jest.fn();
        transformWithVText(`<div v-text></div>`, {
            onError
        });
        expect(onError.mock.calls).toMatchObject([
            [{ code: 55 /* X_V_TEXT_NO_EXPRESSION */ }]
        ]);
    });
});
