import { parse, transform, generate } from '../../src';
import { transformElement } from '../../src/transforms/transformElement';
import { transformOn } from '../../src/transforms/vOn';
import { transformBind } from '../../src/transforms/vBind';
import { transformExpression } from '../../src/transforms/transformExpression';
import { trackSlotScopes, trackVForSlotScopes } from '../../src/transforms/vSlot';
import { CREATE_SLOTS, RENDER_LIST } from '../../src/runtimeHelpers';
import { createObjectMatcher, genFlagText } from '../testUtils';
import { transformFor } from '../../src/transforms/vFor';
import { transformIf } from '../../src/transforms/vIf';
function parseWithSlots(template, options = {}) {
    const ast = parse(template);
    transform(ast, {
        nodeTransforms: [
            transformIf,
            transformFor,
            ...(options.prefixIdentifiers
                ? [trackVForSlotScopes, transformExpression]
                : []),
            transformElement,
            trackSlotScopes
        ],
        directiveTransforms: {
            on: transformOn,
            bind: transformBind
        },
        ...options
    });
    return {
        root: ast,
        slots: ast.children[0].type === 1 /* ELEMENT */
            ? ast.children[0].codegenNode.arguments[2]
            : null
    };
}
function createSlotMatcher(obj) {
    return {
        type: 14 /* JS_OBJECT_EXPRESSION */,
        properties: Object.keys(obj)
            .map(key => {
            return {
                type: 15 /* JS_PROPERTY */,
                key: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    isStatic: !/^\[/.test(key),
                    content: key.replace(/^\[|\]$/g, '')
                },
                value: obj[key]
            };
        })
            .concat({
            key: { content: `_compiled` },
            value: { content: `true` }
        })
    };
}
describe('compiler: transform component slots', () => {
    test('implicit default slot', () => {
        const { root, slots } = parseWithSlots(`<Comp><div/></Comp>`, {
            prefixIdentifiers: true
        });
        expect(slots).toMatchObject(createSlotMatcher({
            default: {
                type: 17 /* JS_FUNCTION_EXPRESSION */,
                params: undefined,
                returns: [
                    {
                        type: 1 /* ELEMENT */,
                        tag: `div`
                    }
                ]
            }
        }));
        expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot();
    });
    test('explicit default slot', () => {
        const { root, slots } = parseWithSlots(`<Comp v-slot="{ foo }">{{ foo }}{{ bar }}</Comp>`, { prefixIdentifiers: true });
        expect(slots).toMatchObject(createSlotMatcher({
            default: {
                type: 17 /* JS_FUNCTION_EXPRESSION */,
                params: {
                    type: 8 /* COMPOUND_EXPRESSION */,
                    children: [`{ `, { content: `foo` }, ` }`]
                },
                returns: [
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `foo`
                        }
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `_ctx.bar`
                        }
                    }
                ]
            }
        }));
        expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot();
    });
    test('named slots', () => {
        const { root, slots } = parseWithSlots(`<Comp>
        <template v-slot:one="{ foo }">
          {{ foo }}{{ bar }}
        </template>
        <template #two="{ bar }">
          {{ foo }}{{ bar }}
        </template>
      </Comp>`, { prefixIdentifiers: true });
        expect(slots).toMatchObject(createSlotMatcher({
            one: {
                type: 17 /* JS_FUNCTION_EXPRESSION */,
                params: {
                    type: 8 /* COMPOUND_EXPRESSION */,
                    children: [`{ `, { content: `foo` }, ` }`]
                },
                returns: [
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `foo`
                        }
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `_ctx.bar`
                        }
                    }
                ]
            },
            two: {
                type: 17 /* JS_FUNCTION_EXPRESSION */,
                params: {
                    type: 8 /* COMPOUND_EXPRESSION */,
                    children: [`{ `, { content: `bar` }, ` }`]
                },
                returns: [
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `_ctx.foo`
                        }
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `bar`
                        }
                    }
                ]
            }
        }));
        expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot();
    });
    test('dynamically named slots', () => {
        const { root, slots } = parseWithSlots(`<Comp>
        <template v-slot:[one]="{ foo }">
          {{ foo }}{{ bar }}
        </template>
        <template #[two]="{ bar }">
          {{ foo }}{{ bar }}
        </template>
      </Comp>`, { prefixIdentifiers: true });
        expect(slots).toMatchObject(createSlotMatcher({
            '[_ctx.one]': {
                type: 17 /* JS_FUNCTION_EXPRESSION */,
                params: {
                    type: 8 /* COMPOUND_EXPRESSION */,
                    children: [`{ `, { content: `foo` }, ` }`]
                },
                returns: [
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `foo`
                        }
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `_ctx.bar`
                        }
                    }
                ]
            },
            '[_ctx.two]': {
                type: 17 /* JS_FUNCTION_EXPRESSION */,
                params: {
                    type: 8 /* COMPOUND_EXPRESSION */,
                    children: [`{ `, { content: `bar` }, ` }`]
                },
                returns: [
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `_ctx.foo`
                        }
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `bar`
                        }
                    }
                ]
            }
        }));
        expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot();
    });
    test('nested slots scoping', () => {
        const { root, slots } = parseWithSlots(`<Comp>
        <template #default="{ foo }">
          <Inner v-slot="{ bar }">
            {{ foo }}{{ bar }}{{ baz }}
          </Inner>
          {{ foo }}{{ bar }}{{ baz }}
        </template>
      </Comp>`, { prefixIdentifiers: true });
        expect(slots).toMatchObject(createSlotMatcher({
            default: {
                type: 17 /* JS_FUNCTION_EXPRESSION */,
                params: {
                    type: 8 /* COMPOUND_EXPRESSION */,
                    children: [`{ `, { content: `foo` }, ` }`]
                },
                returns: [
                    {
                        type: 1 /* ELEMENT */,
                        codegenNode: {
                            type: 13 /* JS_CALL_EXPRESSION */,
                            arguments: [
                                `_component_Inner`,
                                `null`,
                                createSlotMatcher({
                                    default: {
                                        type: 17 /* JS_FUNCTION_EXPRESSION */,
                                        params: {
                                            type: 8 /* COMPOUND_EXPRESSION */,
                                            children: [`{ `, { content: `bar` }, ` }`]
                                        },
                                        returns: [
                                            {
                                                type: 5 /* INTERPOLATION */,
                                                content: {
                                                    content: `foo`
                                                }
                                            },
                                            {
                                                type: 5 /* INTERPOLATION */,
                                                content: {
                                                    content: `bar`
                                                }
                                            },
                                            {
                                                type: 5 /* INTERPOLATION */,
                                                content: {
                                                    content: `_ctx.baz`
                                                }
                                            }
                                        ]
                                    }
                                }),
                                // nested slot should be forced dynamic, since scope variables
                                // are not tracked as dependencies of the slot.
                                genFlagText(256 /* DYNAMIC_SLOTS */)
                            ]
                        }
                    },
                    // test scope
                    {
                        type: 2 /* TEXT */,
                        content: ` `
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `foo`
                        }
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `_ctx.bar`
                        }
                    },
                    {
                        type: 5 /* INTERPOLATION */,
                        content: {
                            content: `_ctx.baz`
                        }
                    }
                ]
            }
        }));
        expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot();
    });
    test('should force dynamic when inside v-for', () => {
        const { root } = parseWithSlots(`<div v-for="i in list">
        <Comp v-slot="bar">foo</Comp>
      </div>`);
        const div = root.children[0].children[0]
            .codegenNode;
        const comp = div.arguments[2][0];
        expect(comp.codegenNode.arguments[3]).toBe(genFlagText(256 /* DYNAMIC_SLOTS */));
    });
    test('should only force dynamic slots when actually using scope vars w/ prefixIdentifiers: true', () => {
        function assertDynamicSlots(template, shouldForce) {
            const { root } = parseWithSlots(template, { prefixIdentifiers: true });
            let flag;
            if (root.children[0].type === 11 /* FOR */) {
                const div = root.children[0].children[0]
                    .codegenNode;
                const comp = div.arguments[2][0];
                flag = comp.codegenNode.arguments[3];
            }
            else {
                const innerComp = root.children[0]
                    .children[0];
                flag = innerComp.codegenNode.arguments[3];
            }
            if (shouldForce) {
                expect(flag).toBe(genFlagText(256 /* DYNAMIC_SLOTS */));
            }
            else {
                expect(flag).toBeUndefined();
            }
        }
        assertDynamicSlots(`<div v-for="i in list">
        <Comp v-slot="bar">foo</Comp>
      </div>`, false);
        assertDynamicSlots(`<div v-for="i in list">
        <Comp v-slot="bar">{{ i }}</Comp>
      </div>`, true);
        // reference the component's own slot variable should not force dynamic slots
        assertDynamicSlots(`<Comp v-slot="foo">
        <Comp v-slot="bar">{{ bar }}</Comp>
      </Comp>`, false);
        assertDynamicSlots(`<Comp v-slot="foo">
        <Comp v-slot="bar">{{ foo }}</Comp>
      </Comp>`, true);
    });
    test('named slot with v-if', () => {
        const { root, slots } = parseWithSlots(`<Comp>
        <template #one v-if="ok">hello</template>
      </Comp>`);
        expect(slots).toMatchObject({
            type: 13 /* JS_CALL_EXPRESSION */,
            callee: CREATE_SLOTS,
            arguments: [
                createObjectMatcher({
                    _compiled: `[true]`
                }),
                {
                    type: 16 /* JS_ARRAY_EXPRESSION */,
                    elements: [
                        {
                            type: 19 /* JS_CONDITIONAL_EXPRESSION */,
                            test: { content: `ok` },
                            consequent: createObjectMatcher({
                                name: `one`,
                                fn: {
                                    type: 17 /* JS_FUNCTION_EXPRESSION */,
                                    returns: [{ type: 2 /* TEXT */, content: `hello` }]
                                }
                            }),
                            alternate: {
                                content: `undefined`,
                                isStatic: false
                            }
                        }
                    ]
                }
            ]
        });
        expect(root.children[0].codegenNode.arguments[3]).toMatch(256 /* DYNAMIC_SLOTS */ + '');
        expect(generate(root).code).toMatchSnapshot();
    });
    test('named slot with v-if + prefixIdentifiers: true', () => {
        const { root, slots } = parseWithSlots(`<Comp>
        <template #one="props" v-if="ok">{{ props }}</template>
      </Comp>`, { prefixIdentifiers: true });
        expect(slots).toMatchObject({
            type: 13 /* JS_CALL_EXPRESSION */,
            callee: CREATE_SLOTS,
            arguments: [
                createObjectMatcher({
                    _compiled: `[true]`
                }),
                {
                    type: 16 /* JS_ARRAY_EXPRESSION */,
                    elements: [
                        {
                            type: 19 /* JS_CONDITIONAL_EXPRESSION */,
                            test: { content: `_ctx.ok` },
                            consequent: createObjectMatcher({
                                name: `one`,
                                fn: {
                                    type: 17 /* JS_FUNCTION_EXPRESSION */,
                                    params: { content: `props` },
                                    returns: [
                                        {
                                            type: 5 /* INTERPOLATION */,
                                            content: { content: `props` }
                                        }
                                    ]
                                }
                            }),
                            alternate: {
                                content: `undefined`,
                                isStatic: false
                            }
                        }
                    ]
                }
            ]
        });
        expect(root.children[0].codegenNode.arguments[3]).toMatch(256 /* DYNAMIC_SLOTS */ + '');
        expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot();
    });
    test('named slot with v-if + v-else-if + v-else', () => {
        const { root, slots } = parseWithSlots(`<Comp>
        <template #one v-if="ok">foo</template>
        <template #two="props" v-else-if="orNot">bar</template>
        <template #one v-else>baz</template>
      </Comp>`);
        expect(slots).toMatchObject({
            type: 13 /* JS_CALL_EXPRESSION */,
            callee: CREATE_SLOTS,
            arguments: [
                createObjectMatcher({
                    _compiled: `[true]`
                }),
                {
                    type: 16 /* JS_ARRAY_EXPRESSION */,
                    elements: [
                        {
                            type: 19 /* JS_CONDITIONAL_EXPRESSION */,
                            test: { content: `ok` },
                            consequent: createObjectMatcher({
                                name: `one`,
                                fn: {
                                    type: 17 /* JS_FUNCTION_EXPRESSION */,
                                    params: undefined,
                                    returns: [{ type: 2 /* TEXT */, content: `foo` }]
                                }
                            }),
                            alternate: {
                                type: 19 /* JS_CONDITIONAL_EXPRESSION */,
                                test: { content: `orNot` },
                                consequent: createObjectMatcher({
                                    name: `two`,
                                    fn: {
                                        type: 17 /* JS_FUNCTION_EXPRESSION */,
                                        params: { content: `props` },
                                        returns: [{ type: 2 /* TEXT */, content: `bar` }]
                                    }
                                }),
                                alternate: createObjectMatcher({
                                    name: `one`,
                                    fn: {
                                        type: 17 /* JS_FUNCTION_EXPRESSION */,
                                        params: undefined,
                                        returns: [{ type: 2 /* TEXT */, content: `baz` }]
                                    }
                                })
                            }
                        }
                    ]
                }
            ]
        });
        expect(root.children[0].codegenNode.arguments[3]).toMatch(256 /* DYNAMIC_SLOTS */ + '');
        expect(generate(root).code).toMatchSnapshot();
    });
    test('named slot with v-for w/ prefixIdentifiers: true', () => {
        const { root, slots } = parseWithSlots(`<Comp>
        <template v-for="name in list" #[name]>{{ name }}</template>
      </Comp>`, { prefixIdentifiers: true });
        expect(slots).toMatchObject({
            type: 13 /* JS_CALL_EXPRESSION */,
            callee: CREATE_SLOTS,
            arguments: [
                createObjectMatcher({
                    _compiled: `[true]`
                }),
                {
                    type: 16 /* JS_ARRAY_EXPRESSION */,
                    elements: [
                        {
                            type: 13 /* JS_CALL_EXPRESSION */,
                            callee: RENDER_LIST,
                            arguments: [
                                { content: `_ctx.list` },
                                {
                                    type: 17 /* JS_FUNCTION_EXPRESSION */,
                                    params: [{ content: `name` }],
                                    returns: createObjectMatcher({
                                        name: `[name]`,
                                        fn: {
                                            type: 17 /* JS_FUNCTION_EXPRESSION */,
                                            returns: [
                                                {
                                                    type: 5 /* INTERPOLATION */,
                                                    content: { content: `name`, isStatic: false }
                                                }
                                            ]
                                        }
                                    })
                                }
                            ]
                        }
                    ]
                }
            ]
        });
        expect(root.children[0].codegenNode.arguments[3]).toMatch(256 /* DYNAMIC_SLOTS */ + '');
        expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot();
    });
    describe('errors', () => {
        test('error on extraneous children w/ named slots', () => {
            const onError = jest.fn();
            const source = `<Comp><template #default>foo</template>bar</Comp>`;
            parseWithSlots(source, { onError });
            const index = source.indexOf('bar');
            expect(onError.mock.calls[0][0]).toMatchObject({
                code: 45 /* X_V_SLOT_EXTRANEOUS_NON_SLOT_CHILDREN */,
                loc: {
                    source: `bar`,
                    start: {
                        offset: index,
                        line: 1,
                        column: index + 1
                    },
                    end: {
                        offset: index + 3,
                        line: 1,
                        column: index + 4
                    }
                }
            });
        });
        test('error on duplicated slot names', () => {
            const onError = jest.fn();
            const source = `<Comp><template #foo></template><template #foo></template></Comp>`;
            parseWithSlots(source, { onError });
            const index = source.lastIndexOf('#foo');
            expect(onError.mock.calls[0][0]).toMatchObject({
                code: 44 /* X_V_SLOT_DUPLICATE_SLOT_NAMES */,
                loc: {
                    source: `#foo`,
                    start: {
                        offset: index,
                        line: 1,
                        column: index + 1
                    },
                    end: {
                        offset: index + 4,
                        line: 1,
                        column: index + 5
                    }
                }
            });
        });
        test('error on invalid mixed slot usage', () => {
            const onError = jest.fn();
            const source = `<Comp v-slot="foo"><template #foo></template></Comp>`;
            parseWithSlots(source, { onError });
            const index = source.lastIndexOf('#foo');
            expect(onError.mock.calls[0][0]).toMatchObject({
                code: 43 /* X_V_SLOT_MIXED_SLOT_USAGE */,
                loc: {
                    source: `#foo`,
                    start: {
                        offset: index,
                        line: 1,
                        column: index + 1
                    },
                    end: {
                        offset: index + 4,
                        line: 1,
                        column: index + 5
                    }
                }
            });
        });
        test('error on v-slot usage on plain elements', () => {
            const onError = jest.fn();
            const source = `<div v-slot/>`;
            parseWithSlots(source, { onError });
            const index = source.indexOf('v-slot');
            expect(onError.mock.calls[0][0]).toMatchObject({
                code: 46 /* X_V_SLOT_MISPLACED */,
                loc: {
                    source: `v-slot`,
                    start: {
                        offset: index,
                        line: 1,
                        column: index + 1
                    },
                    end: {
                        offset: index + 6,
                        line: 1,
                        column: index + 7
                    }
                }
            });
        });
        test('error on named slot on component', () => {
            const onError = jest.fn();
            const source = `<Comp v-slot:foo>foo</Comp>`;
            parseWithSlots(source, { onError });
            const index = source.indexOf('v-slot');
            expect(onError.mock.calls[0][0]).toMatchObject({
                code: 42 /* X_V_SLOT_NAMED_SLOT_ON_COMPONENT */,
                loc: {
                    source: `v-slot:foo`,
                    start: {
                        offset: index,
                        line: 1,
                        column: index + 1
                    },
                    end: {
                        offset: index + 10,
                        line: 1,
                        column: index + 11
                    }
                }
            });
        });
    });
});
