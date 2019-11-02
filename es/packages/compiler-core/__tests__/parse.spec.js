import { parse } from '../src/parse';
describe('compiler: parse', () => {
    describe('Text', () => {
        test('simple text', () => {
            const ast = parse('some text');
            const text = ast.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some text',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: 'some text'
                }
            });
        });
        test('simple text with invalid end tag', () => {
            const ast = parse('some text</div>', {
                onError: () => { }
            });
            const text = ast.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some text',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: 'some text'
                }
            });
        });
        test('text with interpolation', () => {
            const ast = parse('some {{ foo + bar }} text');
            const text1 = ast.children[0];
            const text2 = ast.children[2];
            expect(text1).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some ',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: 'some '
                }
            });
            expect(text2).toStrictEqual({
                type: 2 /* TEXT */,
                content: ' text',
                loc: {
                    start: { offset: 20, line: 1, column: 21 },
                    end: { offset: 25, line: 1, column: 26 },
                    source: ' text'
                }
            });
        });
        test('text with interpolation which has `<`', () => {
            const ast = parse('some {{ a<b && c>d }} text');
            const text1 = ast.children[0];
            const text2 = ast.children[2];
            expect(text1).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some ',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: 'some '
                }
            });
            expect(text2).toStrictEqual({
                type: 2 /* TEXT */,
                content: ' text',
                loc: {
                    start: { offset: 21, line: 1, column: 22 },
                    end: { offset: 26, line: 1, column: 27 },
                    source: ' text'
                }
            });
        });
        test('text with mix of tags and interpolations', () => {
            const ast = parse('some <span>{{ foo < bar + foo }} text</span>');
            const text1 = ast.children[0];
            const text2 = ast.children[1].children[1];
            expect(text1).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some ',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: 'some '
                }
            });
            expect(text2).toStrictEqual({
                type: 2 /* TEXT */,
                content: ' text',
                loc: {
                    start: { offset: 32, line: 1, column: 33 },
                    end: { offset: 37, line: 1, column: 38 },
                    source: ' text'
                }
            });
        });
        test('lonly "<" don\'t separate nodes', () => {
            const ast = parse('a < b', {
                onError: err => {
                    if (err.code !== 15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */) {
                        throw err;
                    }
                }
            });
            const text = ast.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'a < b',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: 'a < b'
                }
            });
        });
        test('lonly "{{" don\'t separate nodes', () => {
            const ast = parse('a {{ b', {
                onError: error => {
                    if (error.code !== 33 /* X_MISSING_INTERPOLATION_END */) {
                        throw error;
                    }
                }
            });
            const text = ast.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'a {{ b',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 6, line: 1, column: 7 },
                    source: 'a {{ b'
                }
            });
        });
        test('HTML entities compatibility in text (https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state).', () => {
            const spy = jest.fn();
            const ast = parse('&ampersand;', {
                namedCharacterReferences: { amp: '&' },
                onError: spy
            });
            const text = ast.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: '&ersand;',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 11, line: 1, column: 12 },
                    source: '&ampersand;'
                }
            });
            expect(spy.mock.calls).toMatchObject([
                [
                    {
                        code: 18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */,
                        loc: {
                            start: { offset: 4, line: 1, column: 5 }
                        }
                    }
                ]
            ]);
        });
        test('HTML entities compatibility in attribute (https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state).', () => {
            const spy = jest.fn();
            const ast = parse('<div a="&ampersand;" b="&amp;ersand;" c="&amp!"></div>', {
                namedCharacterReferences: { amp: '&', 'amp;': '&' },
                onError: spy
            });
            const element = ast.children[0];
            const text1 = element.props[0].value;
            const text2 = element.props[1].value;
            const text3 = element.props[2].value;
            expect(text1).toStrictEqual({
                type: 2 /* TEXT */,
                content: '&ampersand;',
                loc: {
                    start: { offset: 7, line: 1, column: 8 },
                    end: { offset: 20, line: 1, column: 21 },
                    source: '"&ampersand;"'
                }
            });
            expect(text2).toStrictEqual({
                type: 2 /* TEXT */,
                content: '&ersand;',
                loc: {
                    start: { offset: 23, line: 1, column: 24 },
                    end: { offset: 37, line: 1, column: 38 },
                    source: '"&amp;ersand;"'
                }
            });
            expect(text3).toStrictEqual({
                type: 2 /* TEXT */,
                content: '&!',
                loc: {
                    start: { offset: 40, line: 1, column: 41 },
                    end: { offset: 47, line: 1, column: 48 },
                    source: '"&amp!"'
                }
            });
            expect(spy.mock.calls).toMatchObject([
                [
                    {
                        code: 18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */,
                        loc: {
                            start: { offset: 45, line: 1, column: 46 }
                        }
                    }
                ]
            ]);
        });
        test('Some control character reference should be replaced.', () => {
            const spy = jest.fn();
            const ast = parse('&#x86;', { onError: spy });
            const text = ast.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: '†',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 6, line: 1, column: 7 },
                    source: '&#x86;'
                }
            });
            expect(spy.mock.calls).toMatchObject([
                [
                    {
                        code: 4 /* CONTROL_CHARACTER_REFERENCE */,
                        loc: {
                            start: { offset: 0, line: 1, column: 1 }
                        }
                    }
                ]
            ]);
        });
    });
    describe('Interpolation', () => {
        test('simple interpolation', () => {
            const ast = parse('{{message}}');
            const interpolation = ast.children[0];
            expect(interpolation).toStrictEqual({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: `message`,
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 2, line: 1, column: 3 },
                        end: { offset: 9, line: 1, column: 10 },
                        source: `message`
                    }
                },
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 11, line: 1, column: 12 },
                    source: '{{message}}'
                }
            });
        });
        test('it can have tag-like notation', () => {
            const ast = parse('{{ a<b }}');
            const interpolation = ast.children[0];
            expect(interpolation).toStrictEqual({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: `a<b`,
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 3, line: 1, column: 4 },
                        end: { offset: 6, line: 1, column: 7 },
                        source: 'a<b'
                    }
                },
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: '{{ a<b }}'
                }
            });
        });
        test('it can have tag-like notation (2)', () => {
            const ast = parse('{{ a<b }}{{ c>d }}');
            const interpolation1 = ast.children[0];
            const interpolation2 = ast.children[1];
            expect(interpolation1).toStrictEqual({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: `a<b`,
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 3, line: 1, column: 4 },
                        end: { offset: 6, line: 1, column: 7 },
                        source: 'a<b'
                    }
                },
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: '{{ a<b }}'
                }
            });
            expect(interpolation2).toStrictEqual({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    isStatic: false,
                    isConstant: false,
                    content: 'c>d',
                    loc: {
                        start: { offset: 12, line: 1, column: 13 },
                        end: { offset: 15, line: 1, column: 16 },
                        source: 'c>d'
                    }
                },
                loc: {
                    start: { offset: 9, line: 1, column: 10 },
                    end: { offset: 18, line: 1, column: 19 },
                    source: '{{ c>d }}'
                }
            });
        });
        test('it can have tag-like notation (3)', () => {
            const ast = parse('<div>{{ "</div>" }}</div>');
            const element = ast.children[0];
            const interpolation = element.children[0];
            expect(interpolation).toStrictEqual({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    isStatic: false,
                    // The `isConstant` is the default value and will be determined in `transformExpression`.
                    isConstant: false,
                    content: '"</div>"',
                    loc: {
                        start: { offset: 8, line: 1, column: 9 },
                        end: { offset: 16, line: 1, column: 17 },
                        source: '"</div>"'
                    }
                },
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 19, line: 1, column: 20 },
                    source: '{{ "</div>" }}'
                }
            });
        });
        test('custom delimiters', () => {
            const ast = parse('<p>{msg}</p>', {
                delimiters: ['{', '}']
            });
            const element = ast.children[0];
            const interpolation = element.children[0];
            expect(interpolation).toStrictEqual({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: `msg`,
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 4, line: 1, column: 5 },
                        end: { offset: 7, line: 1, column: 8 },
                        source: 'msg'
                    }
                },
                loc: {
                    start: { offset: 3, line: 1, column: 4 },
                    end: { offset: 8, line: 1, column: 9 },
                    source: '{msg}'
                }
            });
        });
    });
    describe('Comment', () => {
        test('empty comment', () => {
            const ast = parse('<!---->');
            const comment = ast.children[0];
            expect(comment).toStrictEqual({
                type: 3 /* COMMENT */,
                content: '',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 7, line: 1, column: 8 },
                    source: '<!---->'
                }
            });
        });
        test('simple comment', () => {
            const ast = parse('<!--abc-->');
            const comment = ast.children[0];
            expect(comment).toStrictEqual({
                type: 3 /* COMMENT */,
                content: 'abc',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 10, line: 1, column: 11 },
                    source: '<!--abc-->'
                }
            });
        });
        test('two comments', () => {
            const ast = parse('<!--abc--><!--def-->');
            const comment1 = ast.children[0];
            const comment2 = ast.children[1];
            expect(comment1).toStrictEqual({
                type: 3 /* COMMENT */,
                content: 'abc',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 10, line: 1, column: 11 },
                    source: '<!--abc-->'
                }
            });
            expect(comment2).toStrictEqual({
                type: 3 /* COMMENT */,
                content: 'def',
                loc: {
                    start: { offset: 10, line: 1, column: 11 },
                    end: { offset: 20, line: 1, column: 21 },
                    source: '<!--def-->'
                }
            });
        });
    });
    describe('Element', () => {
        test('simple div', () => {
            const ast = parse('<div>hello</div>');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [],
                isSelfClosing: false,
                children: [
                    {
                        type: 2 /* TEXT */,
                        content: 'hello',
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: 'hello'
                        }
                    }
                ],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 16, line: 1, column: 17 },
                    source: '<div>hello</div>'
                }
            });
        });
        test('empty', () => {
            const ast = parse('<div></div>');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 11, line: 1, column: 12 },
                    source: '<div></div>'
                }
            });
        });
        test('self closing', () => {
            const ast = parse('<div/>after');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [],
                isSelfClosing: true,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 6, line: 1, column: 7 },
                    source: '<div/>'
                }
            });
        });
        test('void element', () => {
            const ast = parse('<img>after', {
                isVoidTag: tag => tag === 'img'
            });
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'img',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: '<img>'
                }
            });
        });
        test('native element with `isNativeTag`', () => {
            const ast = parse('<div></div><comp></comp><Comp></Comp>', {
                isNativeTag: tag => tag === 'div'
            });
            expect(ast.children[0]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'div',
                tagType: 0 /* ELEMENT */
            });
            expect(ast.children[1]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'comp',
                tagType: 1 /* COMPONENT */
            });
            expect(ast.children[2]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'Comp',
                tagType: 1 /* COMPONENT */
            });
        });
        test('native element without `isNativeTag`', () => {
            const ast = parse('<div></div><comp></comp><Comp></Comp>');
            expect(ast.children[0]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'div',
                tagType: 0 /* ELEMENT */
            });
            expect(ast.children[1]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'comp',
                tagType: 0 /* ELEMENT */
            });
            expect(ast.children[2]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'Comp',
                tagType: 1 /* COMPONENT */
            });
        });
        test('custom element', () => {
            const ast = parse('<div></div><comp></comp>', {
                isNativeTag: tag => tag === 'div',
                isCustomElement: tag => tag === 'comp'
            });
            expect(ast.children[0]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'div',
                tagType: 0 /* ELEMENT */
            });
            expect(ast.children[1]).toMatchObject({
                type: 1 /* ELEMENT */,
                tag: 'comp',
                tagType: 0 /* ELEMENT */
            });
        });
        test('attribute with no value', () => {
            const ast = parse('<div id></div>');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'id',
                        value: undefined,
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 7, line: 1, column: 8 },
                            source: 'id'
                        }
                    }
                ],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 14, line: 1, column: 15 },
                    source: '<div id></div>'
                }
            });
        });
        test('attribute with empty value, double quote', () => {
            const ast = parse('<div id=""></div>');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'id',
                        value: {
                            type: 2 /* TEXT */,
                            content: '',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 10, line: 1, column: 11 },
                                source: '""'
                            }
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: 'id=""'
                        }
                    }
                ],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 17, line: 1, column: 18 },
                    source: '<div id=""></div>'
                }
            });
        });
        test('attribute with empty value, single quote', () => {
            const ast = parse("<div id=''></div>");
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'id',
                        value: {
                            type: 2 /* TEXT */,
                            content: '',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 10, line: 1, column: 11 },
                                source: "''"
                            }
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: "id=''"
                        }
                    }
                ],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 17, line: 1, column: 18 },
                    source: "<div id=''></div>"
                }
            });
        });
        test('attribute with value, double quote', () => {
            const ast = parse('<div id=">\'"></div>');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'id',
                        value: {
                            type: 2 /* TEXT */,
                            content: ">'",
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 12, line: 1, column: 13 },
                                source: '">\'"'
                            }
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 12, line: 1, column: 13 },
                            source: 'id=">\'"'
                        }
                    }
                ],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 19, line: 1, column: 20 },
                    source: '<div id=">\'"></div>'
                }
            });
        });
        test('attribute with value, single quote', () => {
            const ast = parse("<div id='>\"'></div>");
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'id',
                        value: {
                            type: 2 /* TEXT */,
                            content: '>"',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 12, line: 1, column: 13 },
                                source: "'>\"'"
                            }
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 12, line: 1, column: 13 },
                            source: "id='>\"'"
                        }
                    }
                ],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 19, line: 1, column: 20 },
                    source: "<div id='>\"'></div>"
                }
            });
        });
        test('attribute with value, unquoted', () => {
            const ast = parse('<div id=a/></div>');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'id',
                        value: {
                            type: 2 /* TEXT */,
                            content: 'a/',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 10, line: 1, column: 11 },
                                source: 'a/'
                            }
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: 'id=a/'
                        }
                    }
                ],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 17, line: 1, column: 18 },
                    source: '<div id=a/></div>'
                }
            });
        });
        test('multiple attributes', () => {
            const ast = parse('<div id=a class="c" inert style=\'\'></div>');
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'div',
                tagType: 0 /* ELEMENT */,
                codegenNode: undefined,
                props: [
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'id',
                        value: {
                            type: 2 /* TEXT */,
                            content: 'a',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 9, line: 1, column: 10 },
                                source: 'a'
                            }
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 9, line: 1, column: 10 },
                            source: 'id=a'
                        }
                    },
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'class',
                        value: {
                            type: 2 /* TEXT */,
                            content: 'c',
                            loc: {
                                start: { offset: 16, line: 1, column: 17 },
                                end: { offset: 19, line: 1, column: 20 },
                                source: '"c"'
                            }
                        },
                        loc: {
                            start: { offset: 10, line: 1, column: 11 },
                            end: { offset: 19, line: 1, column: 20 },
                            source: 'class="c"'
                        }
                    },
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'inert',
                        value: undefined,
                        loc: {
                            start: { offset: 20, line: 1, column: 21 },
                            end: { offset: 25, line: 1, column: 26 },
                            source: 'inert'
                        }
                    },
                    {
                        type: 6 /* ATTRIBUTE */,
                        name: 'style',
                        value: {
                            type: 2 /* TEXT */,
                            content: '',
                            loc: {
                                start: { offset: 32, line: 1, column: 33 },
                                end: { offset: 34, line: 1, column: 35 },
                                source: "''"
                            }
                        },
                        loc: {
                            start: { offset: 26, line: 1, column: 27 },
                            end: { offset: 34, line: 1, column: 35 },
                            source: "style=''"
                        }
                    }
                ],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 41, line: 1, column: 42 },
                    source: '<div id=a class="c" inert style=\'\'></div>'
                }
            });
        });
        test('directive with no value', () => {
            const ast = parse('<div v-if/>');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'if',
                arg: undefined,
                modifiers: [],
                exp: undefined,
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: 'v-if'
                }
            });
        });
        test('directive with value', () => {
            const ast = parse('<div v-if="a"/>');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'if',
                arg: undefined,
                modifiers: [],
                exp: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'a',
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 11, line: 1, column: 12 },
                        end: { offset: 12, line: 1, column: 13 },
                        source: 'a'
                    }
                },
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 13, line: 1, column: 14 },
                    source: 'v-if="a"'
                }
            });
        });
        test('directive with argument', () => {
            const ast = parse('<div v-on:click/>');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'on',
                arg: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'click',
                    isStatic: true,
                    isConstant: true,
                    loc: {
                        source: 'click',
                        start: {
                            column: 11,
                            line: 1,
                            offset: 10
                        },
                        end: {
                            column: 16,
                            line: 1,
                            offset: 15
                        }
                    }
                },
                modifiers: [],
                exp: undefined,
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 15, line: 1, column: 16 },
                    source: 'v-on:click'
                }
            });
        });
        test('directive with a modifier', () => {
            const ast = parse('<div v-on.enter/>');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'on',
                arg: undefined,
                modifiers: ['enter'],
                exp: undefined,
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 15, line: 1, column: 16 },
                    source: 'v-on.enter'
                }
            });
        });
        test('directive with two modifiers', () => {
            const ast = parse('<div v-on.enter.exact/>');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'on',
                arg: undefined,
                modifiers: ['enter', 'exact'],
                exp: undefined,
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 21, line: 1, column: 22 },
                    source: 'v-on.enter.exact'
                }
            });
        });
        test('directive with argument and modifiers', () => {
            const ast = parse('<div v-on:click.enter.exact/>');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'on',
                arg: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'click',
                    isStatic: true,
                    isConstant: true,
                    loc: {
                        source: 'click',
                        start: {
                            column: 11,
                            line: 1,
                            offset: 10
                        },
                        end: {
                            column: 16,
                            line: 1,
                            offset: 15
                        }
                    }
                },
                modifiers: ['enter', 'exact'],
                exp: undefined,
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 27, line: 1, column: 28 },
                    source: 'v-on:click.enter.exact'
                }
            });
        });
        test('v-bind shorthand', () => {
            const ast = parse('<div :a=b />');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'bind',
                arg: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'a',
                    isStatic: true,
                    isConstant: true,
                    loc: {
                        source: 'a',
                        start: {
                            column: 7,
                            line: 1,
                            offset: 6
                        },
                        end: {
                            column: 8,
                            line: 1,
                            offset: 7
                        }
                    }
                },
                modifiers: [],
                exp: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'b',
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 8, line: 1, column: 9 },
                        end: { offset: 9, line: 1, column: 10 },
                        source: 'b'
                    }
                },
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: ':a=b'
                }
            });
        });
        test('v-bind shorthand with modifier', () => {
            const ast = parse('<div :a.sync=b />');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'bind',
                arg: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'a',
                    isStatic: true,
                    isConstant: true,
                    loc: {
                        source: 'a',
                        start: {
                            column: 7,
                            line: 1,
                            offset: 6
                        },
                        end: {
                            column: 8,
                            line: 1,
                            offset: 7
                        }
                    }
                },
                modifiers: ['sync'],
                exp: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'b',
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 13, line: 1, column: 14 },
                        end: { offset: 14, line: 1, column: 15 },
                        source: 'b'
                    }
                },
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 14, line: 1, column: 15 },
                    source: ':a.sync=b'
                }
            });
        });
        test('v-on shorthand', () => {
            const ast = parse('<div @a=b />');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'on',
                arg: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'a',
                    isStatic: true,
                    isConstant: true,
                    loc: {
                        source: 'a',
                        start: {
                            column: 7,
                            line: 1,
                            offset: 6
                        },
                        end: {
                            column: 8,
                            line: 1,
                            offset: 7
                        }
                    }
                },
                modifiers: [],
                exp: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'b',
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 8, line: 1, column: 9 },
                        end: { offset: 9, line: 1, column: 10 },
                        source: 'b'
                    }
                },
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: '@a=b'
                }
            });
        });
        test('v-on shorthand with modifier', () => {
            const ast = parse('<div @a.enter=b />');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'on',
                arg: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'a',
                    isStatic: true,
                    isConstant: true,
                    loc: {
                        source: 'a',
                        start: {
                            column: 7,
                            line: 1,
                            offset: 6
                        },
                        end: {
                            column: 8,
                            line: 1,
                            offset: 7
                        }
                    }
                },
                modifiers: ['enter'],
                exp: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'b',
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 14, line: 1, column: 15 },
                        end: { offset: 15, line: 1, column: 16 },
                        source: 'b'
                    }
                },
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 15, line: 1, column: 16 },
                    source: '@a.enter=b'
                }
            });
        });
        test('v-slot shorthand', () => {
            const ast = parse('<Comp #a="{ b }" />');
            const directive = ast.children[0].props[0];
            expect(directive).toStrictEqual({
                type: 7 /* DIRECTIVE */,
                name: 'slot',
                arg: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: 'a',
                    isStatic: true,
                    isConstant: true,
                    loc: {
                        source: 'a',
                        start: {
                            column: 8,
                            line: 1,
                            offset: 7
                        },
                        end: {
                            column: 9,
                            line: 1,
                            offset: 8
                        }
                    }
                },
                modifiers: [],
                exp: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: '{ b }',
                    isStatic: false,
                    // The `isConstant` is the default value and will be determined in transformExpression
                    isConstant: false,
                    loc: {
                        start: { offset: 10, line: 1, column: 11 },
                        end: { offset: 15, line: 1, column: 16 },
                        source: '{ b }'
                    }
                },
                loc: {
                    start: { offset: 6, line: 1, column: 7 },
                    end: { offset: 16, line: 1, column: 17 },
                    source: '#a="{ b }"'
                }
            });
        });
        test('v-pre', () => {
            const ast = parse(`<div v-pre :id="foo"><Comp/>{{ bar }}</div>\n` +
                `<div :id="foo"><Comp/>{{ bar }}</div>`);
            const divWithPre = ast.children[0];
            expect(divWithPre.props).toMatchObject([
                {
                    type: 6 /* ATTRIBUTE */,
                    name: `:id`,
                    value: {
                        type: 2 /* TEXT */,
                        content: `foo`
                    },
                    loc: {
                        source: `:id="foo"`,
                        start: {
                            line: 1,
                            column: 12
                        },
                        end: {
                            line: 1,
                            column: 21
                        }
                    }
                }
            ]);
            expect(divWithPre.children[0]).toMatchObject({
                type: 1 /* ELEMENT */,
                tagType: 0 /* ELEMENT */,
                tag: `Comp`
            });
            expect(divWithPre.children[1]).toMatchObject({
                type: 2 /* TEXT */,
                content: `{{ bar }}`
            });
            // should not affect siblings after it
            const divWithoutPre = ast.children[1];
            expect(divWithoutPre.props).toMatchObject([
                {
                    type: 7 /* DIRECTIVE */,
                    name: `bind`,
                    arg: {
                        type: 4 /* SIMPLE_EXPRESSION */,
                        isStatic: true,
                        content: `id`
                    },
                    exp: {
                        type: 4 /* SIMPLE_EXPRESSION */,
                        isStatic: false,
                        content: `foo`
                    },
                    loc: {
                        source: `:id="foo"`,
                        start: {
                            line: 2,
                            column: 6
                        },
                        end: {
                            line: 2,
                            column: 15
                        }
                    }
                }
            ]);
            expect(divWithoutPre.children[0]).toMatchObject({
                type: 1 /* ELEMENT */,
                tagType: 1 /* COMPONENT */,
                tag: `Comp`
            });
            expect(divWithoutPre.children[1]).toMatchObject({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: `bar`,
                    isStatic: false
                }
            });
        });
        test('end tags are case-insensitive.', () => {
            const ast = parse('<div>hello</DIV>after');
            const element = ast.children[0];
            const text = element.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'hello',
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 10, line: 1, column: 11 },
                    source: 'hello'
                }
            });
        });
    });
    test('self closing single tag', () => {
        const ast = parse('<div :class="{ some: condition }" />');
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0]).toMatchObject({ tag: 'div' });
    });
    test('self closing multiple tag', () => {
        const ast = parse(`<div :class="{ some: condition }" />\n` +
            `<p v-bind:style="{ color: 'red' }"/>`);
        expect(ast).toMatchSnapshot();
        expect(ast.children).toHaveLength(2);
        expect(ast.children[0]).toMatchObject({ tag: 'div' });
        expect(ast.children[1]).toMatchObject({ tag: 'p' });
    });
    test('valid html', () => {
        const ast = parse(`<div :class="{ some: condition }">\n` +
            `  <p v-bind:style="{ color: 'red' }"/>\n` +
            `  <!-- a comment with <html> inside it -->\n` +
            `</div>`);
        expect(ast).toMatchSnapshot();
        expect(ast.children).toHaveLength(1);
        const el = ast.children[0];
        expect(el).toMatchObject({
            tag: 'div'
        });
        expect(el.children).toHaveLength(2);
        expect(el.children[0]).toMatchObject({
            tag: 'p'
        });
        expect(el.children[1]).toMatchObject({
            type: 3 /* COMMENT */
        });
    });
    test('invalid html', () => {
        expect(() => {
            parse(`<div>\n<span>\n</div>\n</span>`);
        }).toThrow('End tag was not found. (3:1)');
        const spy = jest.fn();
        const ast = parse(`<div>\n<span>\n</div>\n</span>`, {
            onError: spy
        });
        expect(spy.mock.calls).toMatchObject([
            [
                {
                    code: 32 /* X_MISSING_END_TAG */,
                    loc: {
                        start: {
                            offset: 13,
                            line: 3,
                            column: 1
                        }
                    }
                }
            ],
            [
                {
                    code: 31 /* X_INVALID_END_TAG */,
                    loc: {
                        start: {
                            offset: 20,
                            line: 4,
                            column: 1
                        }
                    }
                }
            ]
        ]);
        expect(ast).toMatchSnapshot();
    });
    test('parse with correct location info', () => {
        const [foo, bar, but, baz] = parse(`
foo
 is {{ bar }} but {{ baz }}`.trim()).children;
        let offset = 0;
        expect(foo.loc.start).toEqual({ line: 1, column: 1, offset });
        offset += foo.loc.source.length;
        expect(foo.loc.end).toEqual({ line: 2, column: 5, offset });
        expect(bar.loc.start).toEqual({ line: 2, column: 5, offset });
        const barInner = bar.content;
        offset += 3;
        expect(barInner.loc.start).toEqual({ line: 2, column: 8, offset });
        offset += barInner.loc.source.length;
        expect(barInner.loc.end).toEqual({ line: 2, column: 11, offset });
        offset += 3;
        expect(bar.loc.end).toEqual({ line: 2, column: 14, offset });
        expect(but.loc.start).toEqual({ line: 2, column: 14, offset });
        offset += but.loc.source.length;
        expect(but.loc.end).toEqual({ line: 2, column: 19, offset });
        expect(baz.loc.start).toEqual({ line: 2, column: 19, offset });
        const bazInner = baz.content;
        offset += 3;
        expect(bazInner.loc.start).toEqual({ line: 2, column: 22, offset });
        offset += bazInner.loc.source.length;
        expect(bazInner.loc.end).toEqual({ line: 2, column: 25, offset });
        offset += 3;
        expect(baz.loc.end).toEqual({ line: 2, column: 28, offset });
    });
    describe('namedCharacterReferences option', () => {
        test('use the given map', () => {
            const ast = parse('&amp;&cups;', {
                namedCharacterReferences: {
                    'cups;': '\u222A\uFE00' // UNION with serifs
                },
                onError: () => { } // Ignore errors
            });
            expect(ast.children.length).toBe(1);
            expect(ast.children[0].type).toBe(2 /* TEXT */);
            expect(ast.children[0].content).toBe('&amp;\u222A\uFE00');
        });
    });
    describe('whitespace management', () => {
        it('should remove whitespaces at start/end inside an element', () => {
            const ast = parse(`<div>   <span/>    </div>`);
            expect(ast.children[0].children.length).toBe(1);
        });
        it('should remove whitespaces w/ newline between elements', () => {
            const ast = parse(`<div/> \n <div/> \n <div/>`);
            expect(ast.children.length).toBe(3);
            expect(ast.children.every(c => c.type === 1 /* ELEMENT */)).toBe(true);
        });
        it('should remove whitespaces adjacent to comments', () => {
            const ast = parse(`<div/> \n <!--foo--> <div/>`);
            expect(ast.children.length).toBe(3);
            expect(ast.children[0].type).toBe(1 /* ELEMENT */);
            expect(ast.children[1].type).toBe(3 /* COMMENT */);
            expect(ast.children[2].type).toBe(1 /* ELEMENT */);
        });
        it('should remove whitespaces w/ newline between comments and elements', () => {
            const ast = parse(`<div/> \n <!--foo--> \n <div/>`);
            expect(ast.children.length).toBe(3);
            expect(ast.children[0].type).toBe(1 /* ELEMENT */);
            expect(ast.children[1].type).toBe(3 /* COMMENT */);
            expect(ast.children[2].type).toBe(1 /* ELEMENT */);
        });
        it('should NOT remove whitespaces w/ newline between interpolations', () => {
            const ast = parse(`{{ foo }} \n {{ bar }}`);
            expect(ast.children.length).toBe(3);
            expect(ast.children[0].type).toBe(5 /* INTERPOLATION */);
            expect(ast.children[1]).toMatchObject({
                type: 2 /* TEXT */,
                content: ' '
            });
            expect(ast.children[2].type).toBe(5 /* INTERPOLATION */);
        });
        it('should NOT remove whitespaces w/o newline between elements', () => {
            const ast = parse(`<div/> <div/> <div/>`);
            expect(ast.children.length).toBe(5);
            expect(ast.children.map(c => c.type)).toMatchObject([
                1 /* ELEMENT */,
                2 /* TEXT */,
                1 /* ELEMENT */,
                2 /* TEXT */,
                1 /* ELEMENT */
            ]);
        });
        it('should condense consecutive whitespaces in text', () => {
            const ast = parse(`   foo  \n    bar     baz     `);
            expect(ast.children[0].content).toBe(` foo bar baz `);
        });
    });
    describe('Errors', () => {
        const patterns = {
            ABRUPT_CLOSING_OF_EMPTY_COMMENT: [
                {
                    code: '<template><!--></template>',
                    errors: [
                        {
                            type: 0 /* ABRUPT_CLOSING_OF_EMPTY_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template><!---></template>',
                    errors: [
                        {
                            type: 0 /* ABRUPT_CLOSING_OF_EMPTY_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template><!----></template>',
                    errors: []
                }
            ],
            ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE: [
                {
                    code: '<template>&#a;</template>',
                    errors: [
                        {
                            type: 1 /* ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template>&#xg;</template>',
                    errors: [
                        {
                            type: 1 /* ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template>&#99;</template>',
                    errors: []
                },
                {
                    code: '<template>&#xff;</template>',
                    errors: []
                },
                {
                    code: '<template attr="&#a;"></template>',
                    errors: [
                        {
                            type: 1 /* ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE */,
                            loc: { offset: 16, line: 1, column: 17 }
                        }
                    ]
                },
                {
                    code: '<template attr="&#xg;"></template>',
                    errors: [
                        {
                            type: 1 /* ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE */,
                            loc: { offset: 16, line: 1, column: 17 }
                        }
                    ]
                },
                {
                    code: '<template attr="&#99;"></template>',
                    errors: []
                },
                {
                    code: '<template attr="&#xff;"></template>',
                    errors: []
                }
            ],
            CDATA_IN_HTML_CONTENT: [
                {
                    code: '<template><![CDATA[cdata]]></template>',
                    errors: [
                        {
                            type: 2 /* CDATA_IN_HTML_CONTENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template><svg><![CDATA[cdata]]></svg></template>',
                    errors: []
                }
            ],
            CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE: [
                {
                    code: '<template>&#1234567;</template>',
                    errors: [
                        {
                            type: 3 /* CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                }
            ],
            CONTROL_CHARACTER_REFERENCE: [
                {
                    code: '<template>&#0003;</template>',
                    errors: [
                        {
                            type: 4 /* CONTROL_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template>&#x7F;</template>',
                    errors: [
                        {
                            type: 4 /* CONTROL_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                }
            ],
            DUPLICATE_ATTRIBUTE: [
                {
                    code: '<template><div id="" id=""></div></template>',
                    errors: [
                        {
                            type: 5 /* DUPLICATE_ATTRIBUTE */,
                            loc: { offset: 21, line: 1, column: 22 }
                        }
                    ]
                }
            ],
            END_TAG_WITH_ATTRIBUTES: [
                {
                    code: '<template><div></div id=""></template>',
                    errors: [
                        {
                            type: 6 /* END_TAG_WITH_ATTRIBUTES */,
                            loc: { offset: 21, line: 1, column: 22 }
                        }
                    ]
                }
            ],
            END_TAG_WITH_TRAILING_SOLIDUS: [
                {
                    code: '<template><div></div/></template>',
                    errors: [
                        {
                            type: 7 /* END_TAG_WITH_TRAILING_SOLIDUS */,
                            loc: { offset: 20, line: 1, column: 21 }
                        }
                    ]
                }
            ],
            EOF_BEFORE_TAG_NAME: [
                {
                    code: '<template><',
                    errors: [
                        {
                            type: 8 /* EOF_BEFORE_TAG_NAME */,
                            loc: { offset: 11, line: 1, column: 12 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 11, line: 1, column: 12 }
                        }
                    ]
                },
                {
                    code: '<template></',
                    errors: [
                        {
                            type: 8 /* EOF_BEFORE_TAG_NAME */,
                            loc: { offset: 12, line: 1, column: 13 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 12, line: 1, column: 13 }
                        }
                    ]
                }
            ],
            EOF_IN_CDATA: [
                {
                    code: '<template><svg><![CDATA[cdata',
                    errors: [
                        {
                            type: 9 /* EOF_IN_CDATA */,
                            loc: { offset: 29, line: 1, column: 30 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 29, line: 1, column: 30 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 29, line: 1, column: 30 }
                        }
                    ]
                },
                {
                    code: '<template><svg><![CDATA[',
                    errors: [
                        {
                            type: 9 /* EOF_IN_CDATA */,
                            loc: { offset: 24, line: 1, column: 25 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        }
                    ]
                }
            ],
            EOF_IN_COMMENT: [
                {
                    code: '<template><!--comment',
                    errors: [
                        {
                            type: 10 /* EOF_IN_COMMENT */,
                            loc: { offset: 21, line: 1, column: 22 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 21, line: 1, column: 22 }
                        }
                    ]
                },
                {
                    code: '<template><!--',
                    errors: [
                        {
                            type: 10 /* EOF_IN_COMMENT */,
                            loc: { offset: 14, line: 1, column: 15 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 14, line: 1, column: 15 }
                        }
                    ]
                },
                // Bogus comments don't throw eof-in-comment error.
                // https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state
                {
                    code: '<template><!',
                    errors: [
                        {
                            type: 14 /* INCORRECTLY_OPENED_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 12, line: 1, column: 13 }
                        }
                    ]
                },
                {
                    code: '<template><!-',
                    errors: [
                        {
                            type: 14 /* INCORRECTLY_OPENED_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 13, line: 1, column: 14 }
                        }
                    ]
                },
                {
                    code: '<template><!abc',
                    errors: [
                        {
                            type: 14 /* INCORRECTLY_OPENED_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                }
            ],
            EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT: [
                {
                    code: "<script><!--console.log('hello')",
                    errors: [
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 32, line: 1, column: 33 }
                        },
                        {
                            type: 11 /* EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT */,
                            loc: { offset: 32, line: 1, column: 33 }
                        }
                    ]
                },
                {
                    code: "<script>console.log('hello')",
                    errors: [
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 28, line: 1, column: 29 }
                        }
                    ]
                }
            ],
            EOF_IN_TAG: [
                {
                    code: '<template><div',
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 14, line: 1, column: 15 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 14, line: 1, column: 15 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 14, line: 1, column: 15 }
                        }
                    ]
                },
                {
                    code: '<template><div ',
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 15, line: 1, column: 16 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 15, line: 1, column: 16 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                },
                {
                    code: '<template><div id',
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 17, line: 1, column: 18 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 17, line: 1, column: 18 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 17, line: 1, column: 18 }
                        }
                    ]
                },
                {
                    code: '<template><div id ',
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 18, line: 1, column: 19 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 18, line: 1, column: 19 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 18, line: 1, column: 19 }
                        }
                    ]
                },
                {
                    code: '<template><div id =',
                    errors: [
                        {
                            type: 16 /* MISSING_ATTRIBUTE_VALUE */,
                            loc: { offset: 19, line: 1, column: 20 }
                        },
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 19, line: 1, column: 20 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 19, line: 1, column: 20 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 19, line: 1, column: 20 }
                        }
                    ]
                },
                {
                    code: "<template><div id='abc",
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 22, line: 1, column: 23 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 22, line: 1, column: 23 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 22, line: 1, column: 23 }
                        }
                    ]
                },
                {
                    code: '<template><div id="abc',
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 22, line: 1, column: 23 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 22, line: 1, column: 23 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 22, line: 1, column: 23 }
                        }
                    ]
                },
                {
                    code: "<template><div id='abc'",
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        }
                    ]
                },
                {
                    code: '<template><div id="abc"',
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        }
                    ]
                },
                {
                    code: '<template><div id=abc',
                    errors: [
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 21, line: 1, column: 22 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 21, line: 1, column: 22 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 21, line: 1, column: 22 }
                        }
                    ]
                },
                {
                    code: "<template><div id='abc'/",
                    errors: [
                        {
                            type: 29 /* UNEXPECTED_SOLIDUS_IN_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        }
                    ]
                },
                {
                    code: '<template><div id="abc"/',
                    errors: [
                        {
                            type: 29 /* UNEXPECTED_SOLIDUS_IN_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 24, line: 1, column: 25 }
                        }
                    ]
                },
                {
                    code: '<template><div id=abc /',
                    errors: [
                        {
                            type: 29 /* UNEXPECTED_SOLIDUS_IN_TAG */,
                            loc: { offset: 22, line: 1, column: 23 }
                        },
                        {
                            type: 12 /* EOF_IN_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 23, line: 1, column: 24 }
                        }
                    ]
                }
            ],
            INCORRECTLY_CLOSED_COMMENT: [
                {
                    code: '<template><!--comment--!></template>',
                    errors: [
                        {
                            type: 13 /* INCORRECTLY_CLOSED_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                }
            ],
            INCORRECTLY_OPENED_COMMENT: [
                {
                    code: '<template><!></template>',
                    errors: [
                        {
                            type: 14 /* INCORRECTLY_OPENED_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template><!-></template>',
                    errors: [
                        {
                            type: 14 /* INCORRECTLY_OPENED_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template><!ELEMENT br EMPTY></template>',
                    errors: [
                        {
                            type: 14 /* INCORRECTLY_OPENED_COMMENT */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                // Just ignore doctype.
                {
                    code: '<!DOCTYPE html>',
                    errors: []
                }
            ],
            INVALID_FIRST_CHARACTER_OF_TAG_NAME: [
                {
                    code: '<template>a < b</template>',
                    errors: [
                        {
                            type: 15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */,
                            loc: { offset: 13, line: 1, column: 14 }
                        }
                    ]
                },
                {
                    code: '<template><�></template>',
                    errors: [
                        {
                            type: 15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */,
                            loc: { offset: 11, line: 1, column: 12 }
                        }
                    ]
                },
                {
                    code: '<template>a </ b</template>',
                    errors: [
                        {
                            type: 15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */,
                            loc: { offset: 14, line: 1, column: 15 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 27, line: 1, column: 28 }
                        }
                    ]
                },
                {
                    code: '<template></�></template>',
                    errors: [
                        {
                            type: 15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */,
                            loc: { offset: 12, line: 1, column: 13 }
                        }
                    ]
                },
                // Don't throw invalid-first-character-of-tag-name in interpolation
                {
                    code: '<template>{{a < b}}</template>',
                    errors: []
                }
            ],
            MISSING_ATTRIBUTE_VALUE: [
                {
                    code: '<template><div id=></div></template>',
                    errors: [
                        {
                            type: 16 /* MISSING_ATTRIBUTE_VALUE */,
                            loc: { offset: 18, line: 1, column: 19 }
                        }
                    ]
                },
                {
                    code: '<template><div id= ></div></template>',
                    errors: [
                        {
                            type: 16 /* MISSING_ATTRIBUTE_VALUE */,
                            loc: { offset: 19, line: 1, column: 20 }
                        }
                    ]
                },
                {
                    code: '<template><div id= /></div></template>',
                    errors: []
                }
            ],
            MISSING_END_TAG_NAME: [
                {
                    code: '<template></></template>',
                    errors: [
                        {
                            type: 17 /* MISSING_END_TAG_NAME */,
                            loc: { offset: 12, line: 1, column: 13 }
                        }
                    ]
                }
            ],
            MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE: [
                {
                    code: '<template>&amp</template>',
                    options: { namedCharacterReferences: { amp: '&' } },
                    errors: [
                        {
                            type: 18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */,
                            loc: { offset: 14, line: 1, column: 15 }
                        }
                    ]
                },
                {
                    code: '<template>&#40</template>',
                    errors: [
                        {
                            type: 18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */,
                            loc: { offset: 14, line: 1, column: 15 }
                        }
                    ]
                },
                {
                    code: '<template>&#x40</template>',
                    errors: [
                        {
                            type: 18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                }
            ],
            MISSING_WHITESPACE_BETWEEN_ATTRIBUTES: [
                {
                    code: '<template><div id="foo"class="bar"></div></template>',
                    errors: [
                        {
                            type: 19 /* MISSING_WHITESPACE_BETWEEN_ATTRIBUTES */,
                            loc: { offset: 23, line: 1, column: 24 }
                        }
                    ]
                },
                // CR doesn't appear in tokenization phase, but all CR are removed in preprocessing.
                // https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream
                {
                    code: '<template><div id="foo"\r\nclass="bar"></div></template>',
                    errors: []
                }
            ],
            NESTED_COMMENT: [
                {
                    code: '<template><!--a<!--b--></template>',
                    errors: [
                        {
                            type: 20 /* NESTED_COMMENT */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                },
                {
                    code: '<template><!--a<!--b<!--c--></template>',
                    errors: [
                        {
                            type: 20 /* NESTED_COMMENT */,
                            loc: { offset: 15, line: 1, column: 16 }
                        },
                        {
                            type: 20 /* NESTED_COMMENT */,
                            loc: { offset: 20, line: 1, column: 21 }
                        }
                    ]
                },
                {
                    code: '<template><!--a<!--></template>',
                    errors: []
                },
                {
                    code: '<template><!--a<!--',
                    errors: [
                        {
                            type: 10 /* EOF_IN_COMMENT */,
                            loc: { offset: 19, line: 1, column: 20 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 19, line: 1, column: 20 }
                        }
                    ]
                }
            ],
            NONCHARACTER_CHARACTER_REFERENCE: [
                {
                    code: '<template>&#xFFFE;</template>',
                    errors: [
                        {
                            type: 21 /* NONCHARACTER_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template>&#x1FFFF;</template>',
                    errors: [
                        {
                            type: 21 /* NONCHARACTER_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                }
            ],
            NULL_CHARACTER_REFERENCE: [
                {
                    code: '<template>&#0000;</template>',
                    errors: [
                        {
                            type: 22 /* NULL_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                }
            ],
            SURROGATE_CHARACTER_REFERENCE: [
                {
                    code: '<template>&#xD800;</template>',
                    errors: [
                        {
                            type: 23 /* SURROGATE_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                }
            ],
            UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME: [
                {
                    code: "<template><div a\"bc=''></div></template>",
                    errors: [
                        {
                            type: 24 /* UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME */,
                            loc: { offset: 16, line: 1, column: 17 }
                        }
                    ]
                },
                {
                    code: "<template><div a'bc=''></div></template>",
                    errors: [
                        {
                            type: 24 /* UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME */,
                            loc: { offset: 16, line: 1, column: 17 }
                        }
                    ]
                },
                {
                    code: "<template><div a<bc=''></div></template>",
                    errors: [
                        {
                            type: 24 /* UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME */,
                            loc: { offset: 16, line: 1, column: 17 }
                        }
                    ]
                }
            ],
            UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE: [
                {
                    code: '<template><div foo=bar"></div></template>',
                    errors: [
                        {
                            type: 25 /* UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE */,
                            loc: { offset: 22, line: 1, column: 23 }
                        }
                    ]
                },
                {
                    code: "<template><div foo=bar'></div></template>",
                    errors: [
                        {
                            type: 25 /* UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE */,
                            loc: { offset: 22, line: 1, column: 23 }
                        }
                    ]
                },
                {
                    code: '<template><div foo=bar<div></div></template>',
                    errors: [
                        {
                            type: 25 /* UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE */,
                            loc: { offset: 22, line: 1, column: 23 }
                        }
                    ]
                },
                {
                    code: '<template><div foo=bar=baz></div></template>',
                    errors: [
                        {
                            type: 25 /* UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE */,
                            loc: { offset: 22, line: 1, column: 23 }
                        }
                    ]
                },
                {
                    code: '<template><div foo=bar`></div></template>',
                    errors: [
                        {
                            type: 25 /* UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE */,
                            loc: { offset: 22, line: 1, column: 23 }
                        }
                    ]
                }
            ],
            UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME: [
                {
                    code: '<template><div =foo=bar></div></template>',
                    errors: [
                        {
                            type: 26 /* UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                },
                {
                    code: '<template><div =></div></template>',
                    errors: [
                        {
                            type: 26 /* UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                }
            ],
            UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME: [
                {
                    code: '<template><?xml?></template>',
                    errors: [
                        {
                            type: 28 /* UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME */,
                            loc: { offset: 11, line: 1, column: 12 }
                        }
                    ]
                }
            ],
            UNEXPECTED_SOLIDUS_IN_TAG: [
                {
                    code: '<template><div a/b></div></template>',
                    errors: [
                        {
                            type: 29 /* UNEXPECTED_SOLIDUS_IN_TAG */,
                            loc: { offset: 16, line: 1, column: 17 }
                        }
                    ]
                }
            ],
            UNKNOWN_NAMED_CHARACTER_REFERENCE: [
                {
                    code: '<template>&unknown;</template>',
                    errors: [
                        {
                            type: 30 /* UNKNOWN_NAMED_CHARACTER_REFERENCE */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                }
            ],
            X_INVALID_END_TAG: [
                {
                    code: '<template></div></template>',
                    errors: [
                        {
                            type: 31 /* X_INVALID_END_TAG */,
                            loc: { offset: 10, line: 1, column: 11 }
                        }
                    ]
                },
                {
                    code: '<template></div></div></template>',
                    errors: [
                        {
                            type: 31 /* X_INVALID_END_TAG */,
                            loc: { offset: 10, line: 1, column: 11 }
                        },
                        {
                            type: 31 /* X_INVALID_END_TAG */,
                            loc: { offset: 16, line: 1, column: 17 }
                        }
                    ]
                },
                {
                    code: "<template>{{'</div>'}}</template>",
                    errors: []
                },
                {
                    code: '<textarea></div></textarea>',
                    errors: []
                },
                {
                    code: '<svg><![CDATA[</div>]]></svg>',
                    errors: []
                },
                {
                    code: '<svg><!--</div>--></svg>',
                    errors: []
                }
            ],
            X_MISSING_END_TAG: [
                {
                    code: '<template><div></template>',
                    errors: [
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                },
                {
                    code: '<template><div>',
                    errors: [
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 15, line: 1, column: 16 }
                        },
                        {
                            type: 32 /* X_MISSING_END_TAG */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                }
            ],
            X_MISSING_INTERPOLATION_END: [
                {
                    code: '{{ foo',
                    errors: [
                        {
                            type: 33 /* X_MISSING_INTERPOLATION_END */,
                            loc: { offset: 0, line: 1, column: 1 }
                        }
                    ]
                },
                {
                    code: '{{',
                    errors: [
                        {
                            type: 33 /* X_MISSING_INTERPOLATION_END */,
                            loc: { offset: 0, line: 1, column: 1 }
                        }
                    ]
                },
                {
                    code: '{{}}',
                    errors: []
                }
            ],
            X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END: [
                {
                    code: `<div v-foo:[sef fsef] />`,
                    errors: [
                        {
                            type: 34 /* X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END */,
                            loc: { offset: 15, line: 1, column: 16 }
                        }
                    ]
                }
            ]
        };
        for (const key of Object.keys(patterns)) {
            describe(key, () => {
                for (const { code, errors, options } of patterns[key]) {
                    test(code.replace(/[\r\n]/g, c => `\\x0${c.codePointAt(0).toString(16)};`), () => {
                        const spy = jest.fn();
                        const ast = parse(code, {
                            getNamespace: (tag, parent) => {
                                const ns = parent ? parent.ns : 0 /* HTML */;
                                if (ns === 0 /* HTML */) {
                                    if (tag === 'svg') {
                                        return (0 /* HTML */ + 1);
                                    }
                                }
                                return ns;
                            },
                            getTextMode: tag => {
                                if (tag === 'textarea') {
                                    return 1 /* RCDATA */;
                                }
                                if (tag === 'script') {
                                    return 2 /* RAWTEXT */;
                                }
                                return 0 /* DATA */;
                            },
                            ...options,
                            onError: spy
                        });
                        expect(spy.mock.calls.map(([err]) => ({
                            type: err.code,
                            loc: err.loc.start
                        }))).toMatchObject(errors);
                        expect(ast).toMatchSnapshot();
                    });
                }
            });
        }
    });
});
