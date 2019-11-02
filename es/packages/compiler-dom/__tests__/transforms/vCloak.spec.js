import { parse, transform } from '@vue/compiler-core';
import { transformCloak } from '../../src/transforms/vCloak';
import { transformElement } from '../../../compiler-core/src/transforms/transformElement';
function transformWithCloak(template) {
    const ast = parse(template);
    transform(ast, {
        nodeTransforms: [transformElement],
        directiveTransforms: {
            cloak: transformCloak
        }
    });
    return ast.children[0];
}
describe('compiler: v-cloak transform', () => {
    test('should add no props to DOM', () => {
        const node = transformWithCloak(`<div v-cloak/>`);
        const codegenArgs = node.codegenNode.arguments;
        // As v-cloak adds no properties the codegen should be identical to
        // rendering a div with no props or reactive data (so just the tag as the arg)
        expect(codegenArgs.length).toBe(1);
    });
});
