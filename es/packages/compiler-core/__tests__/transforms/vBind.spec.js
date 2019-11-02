import { parse, transform } from '../../src';
import { transformBind } from '../../src/transforms/vBind';
import { transformElement } from '../../src/transforms/transformElement';
import { CAMELIZE, helperNameMap } from '../../src/runtimeHelpers';
import { transformExpression } from '../../src/transforms/transformExpression';
function parseWithVBind(template, options = {}) {
    const ast = parse(template);
    transform(ast, {
        nodeTransforms: [
            ...(options.prefixIdentifiers ? [transformExpression] : []),
            transformElement
        ],
        directiveTransforms: {
            bind: transformBind
        },
        ...options
    });
    return ast.children[0];
}
describe('compiler: transform v-bind', () => {
    test('basic', () => {
        const node = parseWithVBind(`<div v-bind:id="id"/>`);
        const props = node.codegenNode
            .arguments[1];
        expect(props.properties[0]).toMatchObject({
            key: {
                content: `id`,
                isStatic: true,
                loc: {
                    start: {
                        line: 1,
                        column: 13
                    },
                    end: {
                        line: 1,
                        column: 15
                    }
                }
            },
            value: {
                content: `id`,
                isStatic: false,
                loc: {
                    start: {
                        line: 1,
                        column: 17
                    },
                    end: {
                        line: 1,
                        column: 19
                    }
                }
            }
        });
    });
    test('dynamic arg', () => {
        const node = parseWithVBind(`<div v-bind:[id]="id"/>`);
        const props = node.codegenNode
            .arguments[1];
        expect(props.properties[0]).toMatchObject({
            key: {
                content: `id`,
                isStatic: false
            },
            value: {
                content: `id`,
                isStatic: false
            }
        });
    });
    test('should error if no expression', () => {
        const onError = jest.fn();
        parseWithVBind(`<div v-bind:arg />`, { onError });
        expect(onError.mock.calls[0][0]).toMatchObject({
            code: 39 /* X_V_BIND_NO_EXPRESSION */,
            loc: {
                start: {
                    line: 1,
                    column: 6
                },
                end: {
                    line: 1,
                    column: 16
                }
            }
        });
    });
    test('.camel modifier', () => {
        const node = parseWithVBind(`<div v-bind:foo-bar.camel="id"/>`);
        const props = node.codegenNode
            .arguments[1];
        expect(props.properties[0]).toMatchObject({
            key: {
                content: `fooBar`,
                isStatic: true
            },
            value: {
                content: `id`,
                isStatic: false
            }
        });
    });
    test('.camel modifier w/ dynamic arg', () => {
        const node = parseWithVBind(`<div v-bind:[foo].camel="id"/>`);
        const props = node.codegenNode
            .arguments[1];
        expect(props.properties[0]).toMatchObject({
            key: {
                content: `_${helperNameMap[CAMELIZE]}(foo)`,
                isStatic: false
            },
            value: {
                content: `id`,
                isStatic: false
            }
        });
    });
    test('.camel modifier w/ dynamic arg + prefixIdentifiers', () => {
        const node = parseWithVBind(`<div v-bind:[foo(bar)].camel="id"/>`, {
            prefixIdentifiers: true
        });
        const props = node.codegenNode
            .arguments[1];
        expect(props.properties[0]).toMatchObject({
            key: {
                children: [
                    `${helperNameMap[CAMELIZE]}(`,
                    { content: `_ctx.foo` },
                    `(`,
                    { content: `_ctx.bar` },
                    `)`,
                    `)`
                ]
            },
            value: {
                content: `_ctx.id`,
                isStatic: false
            }
        });
    });
});
