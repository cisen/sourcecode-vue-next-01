import { parse } from '../../src/parse';
import { transform } from '../../src/transform';
import { transformIf } from '../../src/transforms/vIf';
import { transformElement } from '../../src/transforms/transformElement';
import { transformSlotOutlet } from '../../src/transforms/transformSlotOutlet';
import { generate } from '../../src';
import { OPEN_BLOCK, CREATE_BLOCK, FRAGMENT, MERGE_PROPS, WITH_DIRECTIVES, RENDER_SLOT, CREATE_COMMENT } from '../../src/runtimeHelpers';
import { createObjectMatcher } from '../testUtils';
function parseWithIfTransform(template, options = {}, returnIndex = 0) {
    const ast = parse(template, options);
    transform(ast, {
        nodeTransforms: [transformIf, transformSlotOutlet, transformElement],
        ...options
    });
    if (!options.onError) {
        expect(ast.children.length).toBe(1);
        expect(ast.children[0].type).toBe(9 /* IF */);
    }
    return {
        root: ast,
        node: ast.children[returnIndex]
    };
}
describe('compiler: v-if', () => {
    describe('transform', () => {
        test('basic v-if', () => {
            const { node } = parseWithIfTransform(`<div v-if="ok"/>`);
            expect(node.type).toBe(9 /* IF */);
            expect(node.branches.length).toBe(1);
            expect(node.branches[0].condition.content).toBe(`ok`);
            expect(node.branches[0].children.length).toBe(1);
            expect(node.branches[0].children[0].type).toBe(1 /* ELEMENT */);
            expect(node.branches[0].children[0].tag).toBe(`div`);
        });
        test('template v-if', () => {
            const { node } = parseWithIfTransform(`<template v-if="ok"><div/>hello<p/></template>`);
            expect(node.type).toBe(9 /* IF */);
            expect(node.branches.length).toBe(1);
            expect(node.branches[0].condition.content).toBe(`ok`);
            expect(node.branches[0].children.length).toBe(3);
            expect(node.branches[0].children[0].type).toBe(1 /* ELEMENT */);
            expect(node.branches[0].children[0].tag).toBe(`div`);
            expect(node.branches[0].children[1].type).toBe(2 /* TEXT */);
            expect(node.branches[0].children[1].content).toBe(`hello`);
            expect(node.branches[0].children[2].type).toBe(1 /* ELEMENT */);
            expect(node.branches[0].children[2].tag).toBe(`p`);
        });
        test('v-if + v-else', () => {
            const { node } = parseWithIfTransform(`<div v-if="ok"/><p v-else/>`);
            expect(node.type).toBe(9 /* IF */);
            expect(node.branches.length).toBe(2);
            const b1 = node.branches[0];
            expect(b1.condition.content).toBe(`ok`);
            expect(b1.children.length).toBe(1);
            expect(b1.children[0].type).toBe(1 /* ELEMENT */);
            expect(b1.children[0].tag).toBe(`div`);
            const b2 = node.branches[1];
            expect(b2.condition).toBeUndefined();
            expect(b2.children.length).toBe(1);
            expect(b2.children[0].type).toBe(1 /* ELEMENT */);
            expect(b2.children[0].tag).toBe(`p`);
        });
        test('v-if + v-else-if', () => {
            const { node } = parseWithIfTransform(`<div v-if="ok"/><p v-else-if="orNot"/>`);
            expect(node.type).toBe(9 /* IF */);
            expect(node.branches.length).toBe(2);
            const b1 = node.branches[0];
            expect(b1.condition.content).toBe(`ok`);
            expect(b1.children.length).toBe(1);
            expect(b1.children[0].type).toBe(1 /* ELEMENT */);
            expect(b1.children[0].tag).toBe(`div`);
            const b2 = node.branches[1];
            expect(b2.condition.content).toBe(`orNot`);
            expect(b2.children.length).toBe(1);
            expect(b2.children[0].type).toBe(1 /* ELEMENT */);
            expect(b2.children[0].tag).toBe(`p`);
        });
        test('v-if + v-else-if + v-else', () => {
            const { node } = parseWithIfTransform(`<div v-if="ok"/><p v-else-if="orNot"/><template v-else>fine</template>`);
            expect(node.type).toBe(9 /* IF */);
            expect(node.branches.length).toBe(3);
            const b1 = node.branches[0];
            expect(b1.condition.content).toBe(`ok`);
            expect(b1.children.length).toBe(1);
            expect(b1.children[0].type).toBe(1 /* ELEMENT */);
            expect(b1.children[0].tag).toBe(`div`);
            const b2 = node.branches[1];
            expect(b2.condition.content).toBe(`orNot`);
            expect(b2.children.length).toBe(1);
            expect(b2.children[0].type).toBe(1 /* ELEMENT */);
            expect(b2.children[0].tag).toBe(`p`);
            const b3 = node.branches[2];
            expect(b3.condition).toBeUndefined();
            expect(b3.children.length).toBe(1);
            expect(b3.children[0].type).toBe(2 /* TEXT */);
            expect(b3.children[0].content).toBe(`fine`);
        });
        test('comment between branches', () => {
            const { node } = parseWithIfTransform(`
        <div v-if="ok"/>
        <!--foo-->
        <p v-else-if="orNot"/>
        <!--bar-->
        <template v-else>fine</template>
      `);
            expect(node.type).toBe(9 /* IF */);
            expect(node.branches.length).toBe(3);
            const b1 = node.branches[0];
            expect(b1.condition.content).toBe(`ok`);
            expect(b1.children.length).toBe(1);
            expect(b1.children[0].type).toBe(1 /* ELEMENT */);
            expect(b1.children[0].tag).toBe(`div`);
            const b2 = node.branches[1];
            expect(b2.condition.content).toBe(`orNot`);
            expect(b2.children.length).toBe(2);
            expect(b2.children[0].type).toBe(3 /* COMMENT */);
            expect(b2.children[0].content).toBe(`foo`);
            expect(b2.children[1].type).toBe(1 /* ELEMENT */);
            expect(b2.children[1].tag).toBe(`p`);
            const b3 = node.branches[2];
            expect(b3.condition).toBeUndefined();
            expect(b3.children.length).toBe(2);
            expect(b3.children[0].type).toBe(3 /* COMMENT */);
            expect(b3.children[0].content).toBe(`bar`);
            expect(b3.children[1].type).toBe(2 /* TEXT */);
            expect(b3.children[1].content).toBe(`fine`);
        });
        test('should prefix v-if condition', () => {
            const { node } = parseWithIfTransform(`<div v-if="ok"/>`, {
                prefixIdentifiers: true
            });
            expect(node.branches[0].condition).toMatchObject({
                type: 4 /* SIMPLE_EXPRESSION */,
                content: `_ctx.ok`
            });
        });
    });
    describe('errors', () => {
        test('error on v-else missing adjacent v-if', () => {
            const onError = jest.fn();
            const { node: node1 } = parseWithIfTransform(`<div v-else/>`, { onError });
            expect(onError.mock.calls[0]).toMatchObject([
                {
                    code: 36 /* X_V_ELSE_NO_ADJACENT_IF */,
                    loc: node1.loc
                }
            ]);
            const { node: node2 } = parseWithIfTransform(`<div/><div v-else/>`, { onError }, 1);
            expect(onError.mock.calls[1]).toMatchObject([
                {
                    code: 36 /* X_V_ELSE_NO_ADJACENT_IF */,
                    loc: node2.loc
                }
            ]);
            const { node: node3 } = parseWithIfTransform(`<div/>foo<div v-else/>`, { onError }, 2);
            expect(onError.mock.calls[2]).toMatchObject([
                {
                    code: 36 /* X_V_ELSE_NO_ADJACENT_IF */,
                    loc: node3.loc
                }
            ]);
        });
        test('error on v-else-if missing adjacent v-if', () => {
            const onError = jest.fn();
            const { node: node1 } = parseWithIfTransform(`<div v-else-if="foo"/>`, {
                onError
            });
            expect(onError.mock.calls[0]).toMatchObject([
                {
                    code: 36 /* X_V_ELSE_NO_ADJACENT_IF */,
                    loc: node1.loc
                }
            ]);
            const { node: node2 } = parseWithIfTransform(`<div/><div v-else-if="foo"/>`, { onError }, 1);
            expect(onError.mock.calls[1]).toMatchObject([
                {
                    code: 36 /* X_V_ELSE_NO_ADJACENT_IF */,
                    loc: node2.loc
                }
            ]);
            const { node: node3 } = parseWithIfTransform(`<div/>foo<div v-else-if="foo"/>`, { onError }, 2);
            expect(onError.mock.calls[2]).toMatchObject([
                {
                    code: 36 /* X_V_ELSE_NO_ADJACENT_IF */,
                    loc: node3.loc
                }
            ]);
        });
    });
    describe('codegen', () => {
        function assertSharedCodegen(node, depth = 0, hasElse = false) {
            expect(node).toMatchObject({
                type: 18 /* JS_SEQUENCE_EXPRESSION */,
                expressions: [
                    {
                        type: 13 /* JS_CALL_EXPRESSION */,
                        callee: OPEN_BLOCK,
                        arguments: []
                    },
                    {
                        type: 19 /* JS_CONDITIONAL_EXPRESSION */,
                        test: {
                            content: `ok`
                        },
                        consequent: {
                            type: 13 /* JS_CALL_EXPRESSION */,
                            callee: CREATE_BLOCK
                        },
                        alternate: depth < 1
                            ? {
                                type: 13 /* JS_CALL_EXPRESSION */,
                                callee: hasElse ? CREATE_BLOCK : CREATE_COMMENT
                            }
                            : {
                                type: 19 /* JS_CONDITIONAL_EXPRESSION */,
                                test: {
                                    content: `orNot`
                                },
                                consequent: {
                                    type: 13 /* JS_CALL_EXPRESSION */,
                                    callee: CREATE_BLOCK
                                },
                                alternate: {
                                    type: 13 /* JS_CALL_EXPRESSION */,
                                    callee: hasElse ? CREATE_BLOCK : CREATE_COMMENT
                                }
                            }
                    }
                ]
            });
        }
        test('basic v-if', () => {
            const { root, node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok"/>`);
            assertSharedCodegen(codegenNode);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments).toMatchObject([
                `"div"`,
                createObjectMatcher({ key: `[0]` })
            ]);
            const branch2 = codegenNode.expressions[1]
                .alternate;
            expect(branch2).toMatchObject({
                type: 13 /* JS_CALL_EXPRESSION */,
                callee: CREATE_COMMENT
            });
            expect(generate(root).code).toMatchSnapshot();
        });
        test('template v-if', () => {
            const { root, node: { codegenNode } } = parseWithIfTransform(`<template v-if="ok"><div/>hello<p/></template>`);
            assertSharedCodegen(codegenNode);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments).toMatchObject([
                FRAGMENT,
                createObjectMatcher({ key: `[0]` }),
                [
                    { type: 1 /* ELEMENT */, tag: 'div' },
                    { type: 2 /* TEXT */, content: `hello` },
                    { type: 1 /* ELEMENT */, tag: 'p' }
                ]
            ]);
            const branch2 = codegenNode.expressions[1]
                .alternate;
            expect(branch2).toMatchObject({
                type: 13 /* JS_CALL_EXPRESSION */,
                callee: CREATE_COMMENT
            });
            expect(generate(root).code).toMatchSnapshot();
        });
        test('template v-if w/ single <slot/> child', () => {
            const { root, node: { codegenNode } } = parseWithIfTransform(`<template v-if="ok"><slot/></template>`);
            // assertSharedCodegen(codegenNode)
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1).toMatchObject({
                type: 13 /* JS_CALL_EXPRESSION */,
                callee: RENDER_SLOT,
                arguments: ['$slots', '"default"', createObjectMatcher({ key: `[0]` })]
            });
            expect(generate(root).code).toMatchSnapshot();
        });
        test('v-if on <slot/>', () => {
            const { root, node: { codegenNode } } = parseWithIfTransform(`<slot v-if="ok"></slot>`);
            // assertSharedCodegen(codegenNode)
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1).toMatchObject({
                type: 13 /* JS_CALL_EXPRESSION */,
                callee: RENDER_SLOT,
                arguments: ['$slots', '"default"', createObjectMatcher({ key: `[0]` })]
            });
            expect(generate(root).code).toMatchSnapshot();
        });
        test('v-if + v-else', () => {
            const { root, node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok"/><p v-else/>`);
            assertSharedCodegen(codegenNode, 0, true);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments).toMatchObject([
                `"div"`,
                createObjectMatcher({ key: `[0]` })
            ]);
            const branch2 = codegenNode.expressions[1]
                .alternate;
            expect(branch2.arguments).toMatchObject([
                `"p"`,
                createObjectMatcher({ key: `[1]` })
            ]);
            expect(generate(root).code).toMatchSnapshot();
        });
        test('v-if + v-else-if', () => {
            const { root, node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok"/><p v-else-if="orNot" />`);
            assertSharedCodegen(codegenNode, 1);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments).toMatchObject([
                `"div"`,
                createObjectMatcher({ key: `[0]` })
            ]);
            const branch2 = codegenNode.expressions[1]
                .alternate;
            expect(branch2.consequent.arguments).toMatchObject([
                `"p"`,
                createObjectMatcher({ key: `[1]` })
            ]);
            expect(generate(root).code).toMatchSnapshot();
        });
        test('v-if + v-else-if + v-else', () => {
            const { root, node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok"/><p v-else-if="orNot"/><template v-else>fine</template>`);
            assertSharedCodegen(codegenNode, 1, true);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments).toMatchObject([
                `"div"`,
                createObjectMatcher({ key: `[0]` })
            ]);
            const branch2 = codegenNode.expressions[1]
                .alternate;
            expect(branch2.consequent.arguments).toMatchObject([
                `"p"`,
                createObjectMatcher({ key: `[1]` })
            ]);
            expect(branch2.alternate.arguments).toMatchObject([
                FRAGMENT,
                createObjectMatcher({ key: `[2]` }),
                [
                    {
                        type: 2 /* TEXT */,
                        content: `fine`
                    }
                ]
            ]);
            expect(generate(root).code).toMatchSnapshot();
        });
        test('key injection (only v-bind)', () => {
            const { node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok" v-bind="obj"/>`);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments[1]).toMatchObject({
                type: 13 /* JS_CALL_EXPRESSION */,
                callee: MERGE_PROPS,
                arguments: [createObjectMatcher({ key: `[0]` }), { content: `obj` }]
            });
        });
        test('key injection (before v-bind)', () => {
            const { node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok" id="foo" v-bind="obj"/>`);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments[1]).toMatchObject({
                type: 13 /* JS_CALL_EXPRESSION */,
                callee: MERGE_PROPS,
                arguments: [
                    createObjectMatcher({
                        key: '[0]',
                        id: 'foo'
                    }),
                    { content: `obj` }
                ]
            });
        });
        test('key injection (after v-bind)', () => {
            const { node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok" v-bind="obj" id="foo"/>`);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.arguments[1]).toMatchObject({
                type: 13 /* JS_CALL_EXPRESSION */,
                callee: MERGE_PROPS,
                arguments: [
                    createObjectMatcher({ key: `[0]` }),
                    { content: `obj` },
                    createObjectMatcher({
                        id: 'foo'
                    })
                ]
            });
        });
        test('key injection (w/ custom directive)', () => {
            const { node: { codegenNode } } = parseWithIfTransform(`<div v-if="ok" v-foo />`);
            const branch1 = codegenNode.expressions[1]
                .consequent;
            expect(branch1.callee).toBe(WITH_DIRECTIVES);
            const realBranch = branch1.arguments[0];
            expect(realBranch.arguments[1]).toMatchObject(createObjectMatcher({ key: `[0]` }));
        });
        test.todo('with comments');
    });
});
