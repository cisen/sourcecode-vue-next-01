import { parse } from '../src/parse';
import { transform } from '../src/transform';
import { createCompilerError } from '../src/errors';
import { TO_STRING, OPEN_BLOCK, CREATE_BLOCK, FRAGMENT, RENDER_SLOT, WITH_DIRECTIVES, CREATE_COMMENT } from '../src/runtimeHelpers';
import { transformIf } from '../src/transforms/vIf';
import { transformFor } from '../src/transforms/vFor';
import { transformElement } from '../src/transforms/transformElement';
import { transformSlotOutlet } from '../src/transforms/transformSlotOutlet';
import { transformText } from '../src/transforms/transformText';
describe('compiler: transform', () => {
    test('context state', () => {
        const ast = parse(`<div>hello {{ world }}</div>`);
        // manually store call arguments because context is mutable and shared
        // across calls
        const calls = [];
        const plugin = (node, context) => {
            calls.push([node, Object.assign({}, context)]);
        };
        transform(ast, {
            nodeTransforms: [plugin]
        });
        const div = ast.children[0];
        expect(calls.length).toBe(4);
        expect(calls[0]).toMatchObject([
            ast,
            {
                parent: null,
                currentNode: ast
            }
        ]);
        expect(calls[1]).toMatchObject([
            div,
            {
                parent: ast,
                currentNode: div
            }
        ]);
        expect(calls[2]).toMatchObject([
            div.children[0],
            {
                parent: div,
                currentNode: div.children[0]
            }
        ]);
        expect(calls[3]).toMatchObject([
            div.children[1],
            {
                parent: div,
                currentNode: div.children[1]
            }
        ]);
    });
    test('context.replaceNode', () => {
        const ast = parse(`<div/><span/>`);
        const plugin = (node, context) => {
            if (node.type === 1 /* ELEMENT */ && node.tag === 'div') {
                // change the node to <p>
                context.replaceNode(Object.assign({}, node, {
                    tag: 'p',
                    children: [
                        {
                            type: 2 /* TEXT */,
                            content: 'hello',
                            isEmpty: false
                        }
                    ]
                }));
            }
        };
        const spy = jest.fn(plugin);
        transform(ast, {
            nodeTransforms: [spy]
        });
        expect(ast.children.length).toBe(2);
        const newElement = ast.children[0];
        expect(newElement.tag).toBe('p');
        expect(spy).toHaveBeenCalledTimes(4);
        // should traverse the children of replaced node
        expect(spy.mock.calls[2][0]).toBe(newElement.children[0]);
        // should traverse the node after the replaced node
        expect(spy.mock.calls[3][0]).toBe(ast.children[1]);
    });
    test('context.removeNode', () => {
        const ast = parse(`<span/><div>hello</div><span/>`);
        const c1 = ast.children[0];
        const c2 = ast.children[2];
        const plugin = (node, context) => {
            if (node.type === 1 /* ELEMENT */ && node.tag === 'div') {
                context.removeNode();
            }
        };
        const spy = jest.fn(plugin);
        transform(ast, {
            nodeTransforms: [spy]
        });
        expect(ast.children.length).toBe(2);
        expect(ast.children[0]).toBe(c1);
        expect(ast.children[1]).toBe(c2);
        // should not traverse children of remove node
        expect(spy).toHaveBeenCalledTimes(4);
        // should traverse nodes around removed
        expect(spy.mock.calls[1][0]).toBe(c1);
        expect(spy.mock.calls[3][0]).toBe(c2);
    });
    test('context.removeNode (prev sibling)', () => {
        const ast = parse(`<span/><div/><span/>`);
        const c1 = ast.children[0];
        const c2 = ast.children[2];
        const plugin = (node, context) => {
            if (node.type === 1 /* ELEMENT */ && node.tag === 'div') {
                context.removeNode();
                // remove previous sibling
                context.removeNode(context.parent.children[0]);
            }
        };
        const spy = jest.fn(plugin);
        transform(ast, {
            nodeTransforms: [spy]
        });
        expect(ast.children.length).toBe(1);
        expect(ast.children[0]).toBe(c2);
        expect(spy).toHaveBeenCalledTimes(4);
        // should still traverse first span before removal
        expect(spy.mock.calls[1][0]).toBe(c1);
        // should still traverse last span
        expect(spy.mock.calls[3][0]).toBe(c2);
    });
    test('context.removeNode (next sibling)', () => {
        const ast = parse(`<span/><div/><span/>`);
        const c1 = ast.children[0];
        const d1 = ast.children[1];
        const plugin = (node, context) => {
            if (node.type === 1 /* ELEMENT */ && node.tag === 'div') {
                context.removeNode();
                // remove next sibling
                context.removeNode(context.parent.children[1]);
            }
        };
        const spy = jest.fn(plugin);
        transform(ast, {
            nodeTransforms: [spy]
        });
        expect(ast.children.length).toBe(1);
        expect(ast.children[0]).toBe(c1);
        expect(spy).toHaveBeenCalledTimes(3);
        // should still traverse first span before removal
        expect(spy.mock.calls[1][0]).toBe(c1);
        // should not traverse last span
        expect(spy.mock.calls[2][0]).toBe(d1);
    });
    test('context.hoist', () => {
        const ast = parse(`<div :id="foo"/><div :id="bar"/>`);
        const hoisted = [];
        const mock = (node, context) => {
            if (node.type === 1 /* ELEMENT */) {
                const dir = node.props[0];
                hoisted.push(dir.exp);
                dir.exp = context.hoist(dir.exp);
            }
        };
        transform(ast, {
            nodeTransforms: [mock]
        });
        expect(ast.hoists).toMatchObject(hoisted);
        expect(ast.children[0].props[0].exp.content).toBe(`_hoisted_1`);
        expect(ast.children[1].props[0].exp.content).toBe(`_hoisted_2`);
    });
    test('onError option', () => {
        const ast = parse(`<div/>`);
        const loc = ast.children[0].loc;
        const plugin = (node, context) => {
            context.onError(createCompilerError(31 /* X_INVALID_END_TAG */, node.loc));
        };
        const spy = jest.fn();
        transform(ast, {
            nodeTransforms: [plugin],
            onError: spy
        });
        expect(spy.mock.calls[0]).toMatchObject([
            {
                code: 31 /* X_INVALID_END_TAG */,
                loc
            }
        ]);
    });
    test('should inject toString helper for interpolations', () => {
        const ast = parse(`{{ foo }}`);
        transform(ast, {});
        expect(ast.helpers).toContain(TO_STRING);
    });
    test('should inject createVNode and Comment for comments', () => {
        const ast = parse(`<!--foo-->`);
        transform(ast, {});
        expect(ast.helpers).toContain(CREATE_COMMENT);
    });
    describe('root codegenNode', () => {
        function transformWithCodegen(template) {
            const ast = parse(template);
            transform(ast, {
                nodeTransforms: [
                    transformIf,
                    transformFor,
                    transformText,
                    transformSlotOutlet,
                    transformElement
                ]
            });
            return ast;
        }
        function createBlockMatcher(args) {
            return {
                type: 18 /* JS_SEQUENCE_EXPRESSION */,
                expressions: [
                    {
                        type: 13 /* JS_CALL_EXPRESSION */,
                        callee: OPEN_BLOCK
                    },
                    {
                        type: 13 /* JS_CALL_EXPRESSION */,
                        callee: CREATE_BLOCK,
                        arguments: args
                    }
                ]
            };
        }
        test('no children', () => {
            const ast = transformWithCodegen(``);
            expect(ast.codegenNode).toBeUndefined();
        });
        test('single <slot/>', () => {
            const ast = transformWithCodegen(`<slot/>`);
            expect(ast.codegenNode).toMatchObject({
                codegenNode: {
                    type: 13 /* JS_CALL_EXPRESSION */,
                    callee: RENDER_SLOT
                }
            });
        });
        test('single element', () => {
            const ast = transformWithCodegen(`<div/>`);
            expect(ast.codegenNode).toMatchObject(createBlockMatcher([`"div"`]));
        });
        test('root v-if', () => {
            const ast = transformWithCodegen(`<div v-if="ok" />`);
            expect(ast.codegenNode).toMatchObject({
                type: 9 /* IF */
            });
        });
        test('root v-for', () => {
            const ast = transformWithCodegen(`<div v-for="i in list" />`);
            expect(ast.codegenNode).toMatchObject({
                type: 11 /* FOR */
            });
        });
        test('root element with custom directive', () => {
            const ast = transformWithCodegen(`<div v-foo/>`);
            expect(ast.codegenNode).toMatchObject({
                type: 18 /* JS_SEQUENCE_EXPRESSION */,
                expressions: [
                    {
                        type: 13 /* JS_CALL_EXPRESSION */,
                        callee: OPEN_BLOCK
                    },
                    {
                        type: 13 /* JS_CALL_EXPRESSION */,
                        // should wrap withDirectives() around createBlock()
                        callee: WITH_DIRECTIVES,
                        arguments: [
                            { callee: CREATE_BLOCK },
                            { type: 16 /* JS_ARRAY_EXPRESSION */ }
                        ]
                    }
                ]
            });
        });
        test('single text', () => {
            const ast = transformWithCodegen(`hello`);
            expect(ast.codegenNode).toMatchObject({
                type: 2 /* TEXT */
            });
        });
        test('single interpolation', () => {
            const ast = transformWithCodegen(`{{ foo }}`);
            expect(ast.codegenNode).toMatchObject({
                type: 5 /* INTERPOLATION */
            });
        });
        test('single CompoundExpression', () => {
            const ast = transformWithCodegen(`{{ foo }} bar baz`);
            expect(ast.codegenNode).toMatchObject({
                type: 8 /* COMPOUND_EXPRESSION */
            });
        });
        test('multiple children', () => {
            const ast = transformWithCodegen(`<div/><div/>`);
            expect(ast.codegenNode).toMatchObject(createBlockMatcher([
                FRAGMENT,
                `null`,
                [
                    { type: 1 /* ELEMENT */, tag: `div` },
                    { type: 1 /* ELEMENT */, tag: `div` }
                ]
            ]));
        });
    });
});
