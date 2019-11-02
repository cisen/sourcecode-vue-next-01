import { parse } from '@vue/compiler-core';
import { parserOptionsMinimal as parserOptions } from '../src/parserOptionsMinimal';
describe('DOM parser', () => {
    describe('Text', () => {
        test('textarea handles comments/elements as just text', () => {
            const ast = parse('<textarea>some<div>text</div>and<!--comment--></textarea>', parserOptions);
            const element = ast.children[0];
            const text = element.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some<div>text</div>and<!--comment-->',
                loc: {
                    start: { offset: 10, line: 1, column: 11 },
                    end: { offset: 46, line: 1, column: 47 },
                    source: 'some<div>text</div>and<!--comment-->'
                }
            });
        });
        test('textarea handles character references', () => {
            const ast = parse('<textarea>&amp;</textarea>', parserOptions);
            const element = ast.children[0];
            const text = element.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: '&',
                loc: {
                    start: { offset: 10, line: 1, column: 11 },
                    end: { offset: 15, line: 1, column: 16 },
                    source: '&amp;'
                }
            });
        });
        test('style handles comments/elements as just a text', () => {
            const ast = parse('<style>some<div>text</div>and<!--comment--></style>', parserOptions);
            const element = ast.children[0];
            const text = element.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some<div>text</div>and<!--comment-->',
                loc: {
                    start: { offset: 7, line: 1, column: 8 },
                    end: { offset: 43, line: 1, column: 44 },
                    source: 'some<div>text</div>and<!--comment-->'
                }
            });
        });
        test("style doesn't handle character references", () => {
            const ast = parse('<style>&amp;</style>', parserOptions);
            const element = ast.children[0];
            const text = element.children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: '&amp;',
                loc: {
                    start: { offset: 7, line: 1, column: 8 },
                    end: { offset: 12, line: 1, column: 13 },
                    source: '&amp;'
                }
            });
        });
        test('CDATA', () => {
            const ast = parse('<svg><![CDATA[some text]]></svg>', parserOptions);
            const text = ast.children[0].children[0];
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'some text',
                loc: {
                    start: { offset: 14, line: 1, column: 15 },
                    end: { offset: 23, line: 1, column: 24 },
                    source: 'some text'
                }
            });
        });
        test('<pre> tag should preserve raw whitespace', () => {
            const rawText = `  \na    b    \n   c`;
            const ast = parse(`<pre>${rawText}</pre>`, parserOptions);
            expect(ast.children[0].children[0]).toMatchObject({
                type: 2 /* TEXT */,
                content: rawText
            });
        });
    });
    describe('Interpolation', () => {
        test('HTML entities in interpolation should be translated for backward compatibility.', () => {
            const ast = parse('<div>{{ a &lt; b }}</div>', parserOptions);
            const element = ast.children[0];
            const interpolation = element.children[0];
            expect(interpolation).toStrictEqual({
                type: 5 /* INTERPOLATION */,
                content: {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: `a < b`,
                    isStatic: false,
                    isConstant: false,
                    loc: {
                        start: { offset: 8, line: 1, column: 9 },
                        end: { offset: 16, line: 1, column: 17 },
                        source: 'a &lt; b'
                    }
                },
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 19, line: 1, column: 20 },
                    source: '{{ a &lt; b }}'
                }
            });
        });
    });
    describe('Element', () => {
        test('void element', () => {
            const ast = parse('<img>after', parserOptions);
            const element = ast.children[0];
            expect(element).toStrictEqual({
                type: 1 /* ELEMENT */,
                ns: 0 /* HTML */,
                tag: 'img',
                tagType: 0 /* ELEMENT */,
                props: [],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: '<img>'
                },
                codegenNode: undefined
            });
        });
        test('native element', () => {
            const ast = parse('<div></div><comp></comp><Comp></Comp>', parserOptions);
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
        test('Strict end tag detection for textarea.', () => {
            const ast = parse('<textarea>hello</textarea</textarea0></texTArea a="<>">', {
                ...parserOptions,
                onError: err => {
                    if (err.code !== 6 /* END_TAG_WITH_ATTRIBUTES */) {
                        throw err;
                    }
                }
            });
            const element = ast.children[0];
            const text = element.children[0];
            expect(ast.children.length).toBe(1);
            expect(text).toStrictEqual({
                type: 2 /* TEXT */,
                content: 'hello</textarea</textarea0>',
                loc: {
                    start: { offset: 10, line: 1, column: 11 },
                    end: { offset: 37, line: 1, column: 38 },
                    source: 'hello</textarea</textarea0>'
                }
            });
        });
    });
    describe('Namespaces', () => {
        test('HTML namespace', () => {
            const ast = parse('<html>test</html>', parserOptions);
            const element = ast.children[0];
            expect(element.ns).toBe(0 /* HTML */);
        });
        test('SVG namespace', () => {
            const ast = parse('<svg>test</svg>', parserOptions);
            const element = ast.children[0];
            expect(element.ns).toBe(1 /* SVG */);
        });
        test('MATH_ML namespace', () => {
            const ast = parse('<math>test</math>', parserOptions);
            const element = ast.children[0];
            expect(element.ns).toBe(2 /* MATH_ML */);
        });
        test('SVG in MATH_ML namespace', () => {
            const ast = parse('<math><annotation-xml><svg></svg></annotation-xml></math>', parserOptions);
            const elementMath = ast.children[0];
            const elementAnnotation = elementMath.children[0];
            const elementSvg = elementAnnotation.children[0];
            expect(elementMath.ns).toBe(2 /* MATH_ML */);
            expect(elementSvg.ns).toBe(1 /* SVG */);
        });
        test('html text/html in MATH_ML namespace', () => {
            const ast = parse('<math><annotation-xml encoding="text/html"><test/></annotation-xml></math>', parserOptions);
            const elementMath = ast.children[0];
            const elementAnnotation = elementMath.children[0];
            const element = elementAnnotation.children[0];
            expect(elementMath.ns).toBe(2 /* MATH_ML */);
            expect(element.ns).toBe(0 /* HTML */);
        });
        test('html application/xhtml+xml in MATH_ML namespace', () => {
            const ast = parse('<math><annotation-xml encoding="application/xhtml+xml"><test/></annotation-xml></math>', parserOptions);
            const elementMath = ast.children[0];
            const elementAnnotation = elementMath.children[0];
            const element = elementAnnotation.children[0];
            expect(elementMath.ns).toBe(2 /* MATH_ML */);
            expect(element.ns).toBe(0 /* HTML */);
        });
        test('mtext malignmark in MATH_ML namespace', () => {
            const ast = parse('<math><mtext><malignmark/></mtext></math>', parserOptions);
            const elementMath = ast.children[0];
            const elementText = elementMath.children[0];
            const element = elementText.children[0];
            expect(elementMath.ns).toBe(2 /* MATH_ML */);
            expect(element.ns).toBe(2 /* MATH_ML */);
        });
        test('mtext and not malignmark tag in MATH_ML namespace', () => {
            const ast = parse('<math><mtext><test/></mtext></math>', parserOptions);
            const elementMath = ast.children[0];
            const elementText = elementMath.children[0];
            const element = elementText.children[0];
            expect(elementMath.ns).toBe(2 /* MATH_ML */);
            expect(element.ns).toBe(0 /* HTML */);
        });
        test('foreignObject tag in SVG namespace', () => {
            const ast = parse('<svg><foreignObject><test/></foreignObject></svg>', parserOptions);
            const elementSvg = ast.children[0];
            const elementForeignObject = elementSvg.children[0];
            const element = elementForeignObject.children[0];
            expect(elementSvg.ns).toBe(1 /* SVG */);
            expect(element.ns).toBe(0 /* HTML */);
        });
        test('desc tag in SVG namespace', () => {
            const ast = parse('<svg><desc><test/></desc></svg>', parserOptions);
            const elementSvg = ast.children[0];
            const elementDesc = elementSvg.children[0];
            const element = elementDesc.children[0];
            expect(elementSvg.ns).toBe(1 /* SVG */);
            expect(element.ns).toBe(0 /* HTML */);
        });
        test('title tag in SVG namespace', () => {
            const ast = parse('<svg><title><test/></title></svg>', parserOptions);
            const elementSvg = ast.children[0];
            const elementTitle = elementSvg.children[0];
            const element = elementTitle.children[0];
            expect(elementSvg.ns).toBe(1 /* SVG */);
            expect(element.ns).toBe(0 /* HTML */);
        });
        test('SVG in HTML namespace', () => {
            const ast = parse('<html><svg></svg></html>', parserOptions);
            const elementHtml = ast.children[0];
            const element = elementHtml.children[0];
            expect(elementHtml.ns).toBe(0 /* HTML */);
            expect(element.ns).toBe(1 /* SVG */);
        });
        test('MATH in HTML namespace', () => {
            const ast = parse('<html><math></math></html>', parserOptions);
            const elementHtml = ast.children[0];
            const element = elementHtml.children[0];
            expect(elementHtml.ns).toBe(0 /* HTML */);
            expect(element.ns).toBe(2 /* MATH_ML */);
        });
    });
});
