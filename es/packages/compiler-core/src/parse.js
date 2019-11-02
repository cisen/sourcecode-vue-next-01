import { NO } from '@vue/shared';
import { createCompilerError, defaultOnError } from './errors';
import { assert, advancePositionWithMutation, advancePositionWithClone } from './utils';
import { extend } from '@vue/shared';
export const defaultParserOptions = {
    delimiters: [`{{`, `}}`],
    getNamespace: () => 0 /* HTML */,
    getTextMode: () => 0 /* DATA */,
    isVoidTag: NO,
    isPreTag: NO,
    isCustomElement: NO,
    namedCharacterReferences: {
        'gt;': '>',
        'lt;': '<',
        'amp;': '&',
        'apos;': "'",
        'quot;': '"'
    },
    onError: defaultOnError
};
export function parse(content, options = {}) {
    const context = createParserContext(content, options);
    const start = getCursor(context);
    return {
        type: 0 /* ROOT */,
        children: parseChildren(context, 0 /* DATA */, []),
        helpers: [],
        components: [],
        directives: [],
        hoists: [],
        cached: 0,
        codegenNode: undefined,
        loc: getSelection(context, start)
    };
}
function createParserContext(content, options) {
    return {
        options: {
            ...defaultParserOptions,
            ...options
        },
        column: 1,
        line: 1,
        offset: 0,
        originalSource: content,
        source: content,
        maxCRNameLength: Object.keys(options.namedCharacterReferences ||
            defaultParserOptions.namedCharacterReferences).reduce((max, name) => Math.max(max, name.length), 0),
        inPre: false
    };
}
function parseChildren(context, mode, ancestors) {
    const parent = last(ancestors);
    const ns = parent ? parent.ns : 0 /* HTML */;
    const nodes = [];
    while (!isEnd(context, mode, ancestors)) {
        __DEV__ && assert(context.source.length > 0);
        const s = context.source;
        let node = undefined;
        if (!context.inPre && startsWith(s, context.options.delimiters[0])) {
            // '{{'
            node = parseInterpolation(context, mode);
        }
        else if (mode === 0 /* DATA */ && s[0] === '<') {
            // https://html.spec.whatwg.org/multipage/parsing.html#tag-open-state
            if (s.length === 1) {
                emitError(context, 8 /* EOF_BEFORE_TAG_NAME */, 1);
            }
            else if (s[1] === '!') {
                // https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state
                if (startsWith(s, '<!--')) {
                    node = parseComment(context);
                }
                else if (startsWith(s, '<!DOCTYPE')) {
                    // Ignore DOCTYPE by a limitation.
                    node = parseBogusComment(context);
                }
                else if (startsWith(s, '<![CDATA[')) {
                    if (ns !== 0 /* HTML */) {
                        node = parseCDATA(context, ancestors);
                    }
                    else {
                        emitError(context, 2 /* CDATA_IN_HTML_CONTENT */);
                        node = parseBogusComment(context);
                    }
                }
                else {
                    emitError(context, 14 /* INCORRECTLY_OPENED_COMMENT */);
                    node = parseBogusComment(context);
                }
            }
            else if (s[1] === '/') {
                // https://html.spec.whatwg.org/multipage/parsing.html#end-tag-open-state
                if (s.length === 2) {
                    emitError(context, 8 /* EOF_BEFORE_TAG_NAME */, 2);
                }
                else if (s[2] === '>') {
                    emitError(context, 17 /* MISSING_END_TAG_NAME */, 2);
                    advanceBy(context, 3);
                    continue;
                }
                else if (/[a-z]/i.test(s[2])) {
                    emitError(context, 31 /* X_INVALID_END_TAG */);
                    parseTag(context, 1 /* End */, parent);
                    continue;
                }
                else {
                    emitError(context, 15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */, 2);
                    node = parseBogusComment(context);
                }
            }
            else if (/[a-z]/i.test(s[1])) {
                node = parseElement(context, ancestors);
            }
            else if (s[1] === '?') {
                emitError(context, 28 /* UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME */, 1);
                node = parseBogusComment(context);
            }
            else {
                emitError(context, 15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */, 1);
            }
        }
        if (!node) {
            node = parseText(context, mode);
        }
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                pushNode(nodes, node[i]);
            }
        }
        else {
            pushNode(nodes, node);
        }
    }
    // Whitespace management for more efficient output
    // (same as v2 whitespance: 'condense')
    let removedWhitespace = false;
    if (!parent || !context.options.isPreTag(parent.tag)) {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.type === 2 /* TEXT */) {
                if (!node.content.trim()) {
                    const prev = nodes[i - 1];
                    const next = nodes[i + 1];
                    // If:
                    // - the whitespace is the first or last node, or:
                    // - the whitespace is adjacent to a comment, or:
                    // - the whitespace is between two elements AND contains newline
                    // Then the whitespace is ignored.
                    if (!prev ||
                        !next ||
                        prev.type === 3 /* COMMENT */ ||
                        next.type === 3 /* COMMENT */ ||
                        (prev.type === 1 /* ELEMENT */ &&
                            next.type === 1 /* ELEMENT */ &&
                            /[\r\n]/.test(node.content))) {
                        removedWhitespace = true;
                        nodes[i] = null;
                    }
                    else {
                        // Otherwise, condensed consecutive whitespace inside the text down to
                        // a single space
                        node.content = ' ';
                    }
                }
                else {
                    node.content = node.content.replace(/\s+/g, ' ');
                }
            }
        }
    }
    return removedWhitespace ? nodes.filter(node => node !== null) : nodes;
}
function pushNode(nodes, node) {
    // ignore comments in production
    /* istanbul ignore next */
    if (!__DEV__ && node.type === 3 /* COMMENT */) {
        return;
    }
    if (node.type === 2 /* TEXT */) {
        const prev = last(nodes);
        // Merge if both this and the previous node are text and those are
        // consecutive. This happens for cases like "a < b".
        if (prev &&
            prev.type === 2 /* TEXT */ &&
            prev.loc.end.offset === node.loc.start.offset) {
            prev.content += node.content;
            prev.loc.end = node.loc.end;
            prev.loc.source += node.loc.source;
            return;
        }
    }
    nodes.push(node);
}
function parseCDATA(context, ancestors) {
    __DEV__ &&
        assert(last(ancestors) == null || last(ancestors).ns !== 0 /* HTML */);
    __DEV__ && assert(startsWith(context.source, '<![CDATA['));
    advanceBy(context, 9);
    const nodes = parseChildren(context, 3 /* CDATA */, ancestors);
    if (context.source.length === 0) {
        emitError(context, 9 /* EOF_IN_CDATA */);
    }
    else {
        __DEV__ && assert(startsWith(context.source, ']]>'));
        advanceBy(context, 3);
    }
    return nodes;
}
function parseComment(context) {
    __DEV__ && assert(startsWith(context.source, '<!--'));
    const start = getCursor(context);
    let content;
    // Regular comment.
    const match = /--(\!)?>/.exec(context.source);
    if (!match) {
        content = context.source.slice(4);
        advanceBy(context, context.source.length);
        emitError(context, 10 /* EOF_IN_COMMENT */);
    }
    else {
        if (match.index <= 3) {
            emitError(context, 0 /* ABRUPT_CLOSING_OF_EMPTY_COMMENT */);
        }
        if (match[1]) {
            emitError(context, 13 /* INCORRECTLY_CLOSED_COMMENT */);
        }
        content = context.source.slice(4, match.index);
        // Advancing with reporting nested comments.
        const s = context.source.slice(0, match.index);
        let prevIndex = 1, nestedIndex = 0;
        while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
            advanceBy(context, nestedIndex - prevIndex + 1);
            if (nestedIndex + 4 < s.length) {
                emitError(context, 20 /* NESTED_COMMENT */);
            }
            prevIndex = nestedIndex + 1;
        }
        advanceBy(context, match.index + match[0].length - prevIndex + 1);
    }
    return {
        type: 3 /* COMMENT */,
        content,
        loc: getSelection(context, start)
    };
}
function parseBogusComment(context) {
    __DEV__ && assert(/^<(?:[\!\?]|\/[^a-z>])/i.test(context.source));
    const start = getCursor(context);
    const contentStart = context.source[1] === '?' ? 1 : 2;
    let content;
    const closeIndex = context.source.indexOf('>');
    if (closeIndex === -1) {
        content = context.source.slice(contentStart);
        advanceBy(context, context.source.length);
    }
    else {
        content = context.source.slice(contentStart, closeIndex);
        advanceBy(context, closeIndex + 1);
    }
    return {
        type: 3 /* COMMENT */,
        content,
        loc: getSelection(context, start)
    };
}
function parseElement(context, ancestors) {
    __DEV__ && assert(/^<[a-z]/i.test(context.source));
    // Start tag.
    const wasInPre = context.inPre;
    const parent = last(ancestors);
    const element = parseTag(context, 0 /* Start */, parent);
    const isPreBoundary = context.inPre && !wasInPre;
    if (element.isSelfClosing || context.options.isVoidTag(element.tag)) {
        return element;
    }
    // Children.
    ancestors.push(element);
    const mode = context.options.getTextMode(element.tag, element.ns);
    const children = parseChildren(context, mode, ancestors);
    ancestors.pop();
    element.children = children;
    // End tag.
    if (startsWithEndTagOpen(context.source, element.tag)) {
        parseTag(context, 1 /* End */, parent);
    }
    else {
        emitError(context, 32 /* X_MISSING_END_TAG */);
        if (context.source.length === 0 && element.tag.toLowerCase() === 'script') {
            const first = children[0];
            if (first && startsWith(first.loc.source, '<!--')) {
                emitError(context, 11 /* EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT */);
            }
        }
    }
    element.loc = getSelection(context, element.loc.start);
    if (isPreBoundary) {
        context.inPre = false;
    }
    return element;
}
/**
 * Parse a tag (E.g. `<div id=a>`) with that type (start tag or end tag).
 */
function parseTag(context, type, parent) {
    __DEV__ && assert(/^<\/?[a-z]/i.test(context.source));
    __DEV__ &&
        assert(type === (startsWith(context.source, '</') ? 1 /* End */ : 0 /* Start */));
    // Tag open.
    const start = getCursor(context);
    const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source);
    const tag = match[1];
    const ns = context.options.getNamespace(tag, parent);
    advanceBy(context, match[0].length);
    advanceSpaces(context);
    // save current state in case we need to re-parse attributes with v-pre
    const cursor = getCursor(context);
    const currentSource = context.source;
    // Attributes.
    let props = parseAttributes(context, type);
    // check v-pre
    if (!context.inPre &&
        props.some(p => p.type === 7 /* DIRECTIVE */ && p.name === 'pre')) {
        context.inPre = true;
        // reset context
        extend(context, cursor);
        context.source = currentSource;
        // re-parse attrs and filter out v-pre itself
        props = parseAttributes(context, type).filter(p => p.name !== 'v-pre');
    }
    // Tag close.
    let isSelfClosing = false;
    if (context.source.length === 0) {
        emitError(context, 12 /* EOF_IN_TAG */);
    }
    else {
        isSelfClosing = startsWith(context.source, '/>');
        if (type === 1 /* End */ && isSelfClosing) {
            emitError(context, 7 /* END_TAG_WITH_TRAILING_SOLIDUS */);
        }
        advanceBy(context, isSelfClosing ? 2 : 1);
    }
    let tagType = 0 /* ELEMENT */;
    if (!context.inPre && !context.options.isCustomElement(tag)) {
        if (context.options.isNativeTag) {
            if (!context.options.isNativeTag(tag))
                tagType = 1 /* COMPONENT */;
        }
        else {
            if (/^[A-Z]/.test(tag))
                tagType = 1 /* COMPONENT */;
        }
        if (tag === 'slot')
            tagType = 2 /* SLOT */;
        else if (tag === 'template')
            tagType = 3 /* TEMPLATE */;
        else if (tag === 'portal' || tag === 'Portal')
            tagType = 4 /* PORTAL */;
        else if (tag === 'suspense' || tag === 'Suspense')
            tagType = 5 /* SUSPENSE */;
    }
    return {
        type: 1 /* ELEMENT */,
        ns,
        tag,
        tagType,
        props,
        isSelfClosing,
        children: [],
        loc: getSelection(context, start),
        codegenNode: undefined // to be created during transform phase
    };
}
function parseAttributes(context, type) {
    const props = [];
    const attributeNames = new Set();
    while (context.source.length > 0 &&
        !startsWith(context.source, '>') &&
        !startsWith(context.source, '/>')) {
        if (startsWith(context.source, '/')) {
            emitError(context, 29 /* UNEXPECTED_SOLIDUS_IN_TAG */);
            advanceBy(context, 1);
            advanceSpaces(context);
            continue;
        }
        if (type === 1 /* End */) {
            emitError(context, 6 /* END_TAG_WITH_ATTRIBUTES */);
        }
        const attr = parseAttribute(context, attributeNames);
        if (type === 0 /* Start */) {
            props.push(attr);
        }
        if (/^[^\t\r\n\f />]/.test(context.source)) {
            emitError(context, 19 /* MISSING_WHITESPACE_BETWEEN_ATTRIBUTES */);
        }
        advanceSpaces(context);
    }
    return props;
}
function parseAttribute(context, nameSet) {
    __DEV__ && assert(/^[^\t\r\n\f />]/.test(context.source));
    // Name.
    const start = getCursor(context);
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
    const name = match[0];
    if (nameSet.has(name)) {
        emitError(context, 5 /* DUPLICATE_ATTRIBUTE */);
    }
    nameSet.add(name);
    if (name[0] === '=') {
        emitError(context, 26 /* UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME */);
    }
    {
        const pattern = /["'<]/g;
        let m;
        while ((m = pattern.exec(name)) !== null) {
            emitError(context, 24 /* UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME */, m.index);
        }
    }
    advanceBy(context, name.length);
    // Value
    let value = undefined;
    if (/^[\t\r\n\f ]*=/.test(context.source)) {
        advanceSpaces(context);
        advanceBy(context, 1);
        advanceSpaces(context);
        value = parseAttributeValue(context);
        if (!value) {
            emitError(context, 16 /* MISSING_ATTRIBUTE_VALUE */);
        }
    }
    const loc = getSelection(context, start);
    if (!context.inPre && /^(v-|:|@|#)/.test(name)) {
        const match = /(?:^v-([a-z0-9-]+))?(?:(?::|^@|^#)([^\.]+))?(.+)?$/i.exec(name);
        let arg;
        if (match[2]) {
            const startOffset = name.split(match[2], 2).shift().length;
            const loc = getSelection(context, getNewPosition(context, start, startOffset), getNewPosition(context, start, startOffset + match[2].length));
            let content = match[2];
            let isStatic = true;
            if (content.startsWith('[')) {
                isStatic = false;
                if (!content.endsWith(']')) {
                    emitError(context, 34 /* X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END */);
                }
                content = content.substr(1, content.length - 2);
            }
            arg = {
                type: 4 /* SIMPLE_EXPRESSION */,
                content,
                isStatic,
                isConstant: isStatic,
                loc
            };
        }
        if (value && value.isQuoted) {
            const valueLoc = value.loc;
            valueLoc.start.offset++;
            valueLoc.start.column++;
            valueLoc.end = advancePositionWithClone(valueLoc.start, value.content);
            valueLoc.source = valueLoc.source.slice(1, -1);
        }
        return {
            type: 7 /* DIRECTIVE */,
            name: match[1] ||
                (startsWith(name, ':')
                    ? 'bind'
                    : startsWith(name, '@')
                        ? 'on'
                        : 'slot'),
            exp: value && {
                type: 4 /* SIMPLE_EXPRESSION */,
                content: value.content,
                isStatic: false,
                // Treat as non-constant by default. This can be potentially set to
                // true by `transformExpression` to make it eligible for hoisting.
                isConstant: false,
                loc: value.loc
            },
            arg,
            modifiers: match[3] ? match[3].substr(1).split('.') : [],
            loc
        };
    }
    return {
        type: 6 /* ATTRIBUTE */,
        name,
        value: value && {
            type: 2 /* TEXT */,
            content: value.content,
            loc: value.loc
        },
        loc
    };
}
function parseAttributeValue(context) {
    const start = getCursor(context);
    let content;
    const quote = context.source[0];
    const isQuoted = quote === `"` || quote === `'`;
    if (isQuoted) {
        // Quoted value.
        advanceBy(context, 1);
        const endIndex = context.source.indexOf(quote);
        if (endIndex === -1) {
            content = parseTextData(context, context.source.length, 4 /* ATTRIBUTE_VALUE */);
        }
        else {
            content = parseTextData(context, endIndex, 4 /* ATTRIBUTE_VALUE */);
            advanceBy(context, 1);
        }
    }
    else {
        // Unquoted
        const match = /^[^\t\r\n\f >]+/.exec(context.source);
        if (!match) {
            return undefined;
        }
        let unexpectedChars = /["'<=`]/g;
        let m;
        while ((m = unexpectedChars.exec(match[0])) !== null) {
            emitError(context, 25 /* UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE */, m.index);
        }
        content = parseTextData(context, match[0].length, 4 /* ATTRIBUTE_VALUE */);
    }
    return { content, isQuoted, loc: getSelection(context, start) };
}
function parseInterpolation(context, mode) {
    const [open, close] = context.options.delimiters;
    __DEV__ && assert(startsWith(context.source, open));
    const closeIndex = context.source.indexOf(close, open.length);
    if (closeIndex === -1) {
        emitError(context, 33 /* X_MISSING_INTERPOLATION_END */);
        return undefined;
    }
    const start = getCursor(context);
    advanceBy(context, open.length);
    const innerStart = getCursor(context);
    const innerEnd = getCursor(context);
    const rawContentLength = closeIndex - open.length;
    const rawContent = context.source.slice(0, rawContentLength);
    const preTrimContent = parseTextData(context, rawContentLength, mode);
    const content = preTrimContent.trim();
    const startOffset = preTrimContent.indexOf(content);
    if (startOffset > 0) {
        advancePositionWithMutation(innerStart, rawContent, startOffset);
    }
    const endOffset = rawContentLength - (preTrimContent.length - content.length - startOffset);
    advancePositionWithMutation(innerEnd, rawContent, endOffset);
    advanceBy(context, close.length);
    return {
        type: 5 /* INTERPOLATION */,
        content: {
            type: 4 /* SIMPLE_EXPRESSION */,
            isStatic: false,
            // Set `isConstant` to false by default and will decide in transformExpression
            isConstant: false,
            content,
            loc: getSelection(context, innerStart, innerEnd)
        },
        loc: getSelection(context, start)
    };
}
function parseText(context, mode) {
    __DEV__ && assert(context.source.length > 0);
    const [open] = context.options.delimiters;
    // TODO could probably use some perf optimization
    const endIndex = Math.min(...[
        context.source.indexOf('<', 1),
        context.source.indexOf(open, 1),
        mode === 3 /* CDATA */ ? context.source.indexOf(']]>') : -1,
        context.source.length
    ].filter(n => n !== -1));
    __DEV__ && assert(endIndex > 0);
    const start = getCursor(context);
    const content = parseTextData(context, endIndex, mode);
    return {
        type: 2 /* TEXT */,
        content,
        loc: getSelection(context, start)
    };
}
/**
 * Get text data with a given length from the current location.
 * This translates HTML entities in the text data.
 */
function parseTextData(context, length, mode) {
    if (mode === 2 /* RAWTEXT */ || mode === 3 /* CDATA */) {
        const text = context.source.slice(0, length);
        advanceBy(context, length);
        return text;
    }
    // DATA or RCDATA. Entity decoding required.
    const end = context.offset + length;
    let text = '';
    while (context.offset < end) {
        const head = /&(?:#x?)?/i.exec(context.source);
        if (!head || context.offset + head.index >= end) {
            const remaining = end - context.offset;
            text += context.source.slice(0, remaining);
            advanceBy(context, remaining);
            break;
        }
        // Advance to the "&".
        text += context.source.slice(0, head.index);
        advanceBy(context, head.index);
        if (head[0] === '&') {
            // Named character reference.
            let name = '', value = undefined;
            if (/[0-9a-z]/i.test(context.source[1])) {
                for (let length = context.maxCRNameLength; !value && length > 0; --length) {
                    name = context.source.substr(1, length);
                    value = context.options.namedCharacterReferences[name];
                }
                if (value) {
                    const semi = name.endsWith(';');
                    if (mode === 4 /* ATTRIBUTE_VALUE */ &&
                        !semi &&
                        /[=a-z0-9]/i.test(context.source[1 + name.length] || '')) {
                        text += '&';
                        text += name;
                        advanceBy(context, 1 + name.length);
                    }
                    else {
                        text += value;
                        advanceBy(context, 1 + name.length);
                        if (!semi) {
                            emitError(context, 18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */);
                        }
                    }
                }
                else {
                    emitError(context, 30 /* UNKNOWN_NAMED_CHARACTER_REFERENCE */);
                    text += '&';
                    text += name;
                    advanceBy(context, 1 + name.length);
                }
            }
            else {
                text += '&';
                advanceBy(context, 1);
            }
        }
        else {
            // Numeric character reference.
            const hex = head[0] === '&#x';
            const pattern = hex ? /^&#x([0-9a-f]+);?/i : /^&#([0-9]+);?/;
            const body = pattern.exec(context.source);
            if (!body) {
                text += head[0];
                emitError(context, 1 /* ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE */);
                advanceBy(context, head[0].length);
            }
            else {
                // https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state
                let cp = Number.parseInt(body[1], hex ? 16 : 10);
                if (cp === 0) {
                    emitError(context, 22 /* NULL_CHARACTER_REFERENCE */);
                    cp = 0xfffd;
                }
                else if (cp > 0x10ffff) {
                    emitError(context, 3 /* CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE */);
                    cp = 0xfffd;
                }
                else if (cp >= 0xd800 && cp <= 0xdfff) {
                    emitError(context, 23 /* SURROGATE_CHARACTER_REFERENCE */);
                    cp = 0xfffd;
                }
                else if ((cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe) {
                    emitError(context, 21 /* NONCHARACTER_CHARACTER_REFERENCE */);
                }
                else if ((cp >= 0x01 && cp <= 0x08) ||
                    cp === 0x0b ||
                    (cp >= 0x0d && cp <= 0x1f) ||
                    (cp >= 0x7f && cp <= 0x9f)) {
                    emitError(context, 4 /* CONTROL_CHARACTER_REFERENCE */);
                    cp = CCR_REPLACEMENTS[cp] || cp;
                }
                text += String.fromCodePoint(cp);
                advanceBy(context, body[0].length);
                if (!body[0].endsWith(';')) {
                    emitError(context, 18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */);
                }
            }
        }
    }
    return text;
}
function getCursor(context) {
    const { column, line, offset } = context;
    return { column, line, offset };
}
function getSelection(context, start, end) {
    end = end || getCursor(context);
    return {
        start,
        end,
        source: context.originalSource.slice(start.offset, end.offset)
    };
}
function last(xs) {
    return xs[xs.length - 1];
}
function startsWith(source, searchString) {
    return source.startsWith(searchString);
}
function advanceBy(context, numberOfCharacters) {
    const { source } = context;
    __DEV__ && assert(numberOfCharacters <= source.length);
    advancePositionWithMutation(context, source, numberOfCharacters);
    context.source = source.slice(numberOfCharacters);
}
function advanceSpaces(context) {
    const match = /^[\t\r\n\f ]+/.exec(context.source);
    if (match) {
        advanceBy(context, match[0].length);
    }
}
function getNewPosition(context, start, numberOfCharacters) {
    return advancePositionWithClone(start, context.originalSource.slice(start.offset, numberOfCharacters), numberOfCharacters);
}
function emitError(context, code, offset) {
    const loc = getCursor(context);
    if (offset) {
        loc.offset += offset;
        loc.column += offset;
    }
    context.options.onError(createCompilerError(code, {
        start: loc,
        end: loc,
        source: ''
    }));
}
function isEnd(context, mode, ancestors) {
    const s = context.source;
    switch (mode) {
        case 0 /* DATA */:
            if (startsWith(s, '</')) {
                //TODO: probably bad performance
                for (let i = ancestors.length - 1; i >= 0; --i) {
                    if (startsWithEndTagOpen(s, ancestors[i].tag)) {
                        return true;
                    }
                }
            }
            break;
        case 1 /* RCDATA */:
        case 2 /* RAWTEXT */: {
            const parent = last(ancestors);
            if (parent && startsWithEndTagOpen(s, parent.tag)) {
                return true;
            }
            break;
        }
        case 3 /* CDATA */:
            if (startsWith(s, ']]>')) {
                return true;
            }
            break;
    }
    return !s;
}
function startsWithEndTagOpen(source, tag) {
    return (startsWith(source, '</') &&
        source.substr(2, tag.length).toLowerCase() === tag.toLowerCase() &&
        /[\t\n\f />]/.test(source[2 + tag.length] || '>'));
}
// https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state
const CCR_REPLACEMENTS = {
    0x80: 0x20ac,
    0x82: 0x201a,
    0x83: 0x0192,
    0x84: 0x201e,
    0x85: 0x2026,
    0x86: 0x2020,
    0x87: 0x2021,
    0x88: 0x02c6,
    0x89: 0x2030,
    0x8a: 0x0160,
    0x8b: 0x2039,
    0x8c: 0x0152,
    0x8e: 0x017d,
    0x91: 0x2018,
    0x92: 0x2019,
    0x93: 0x201c,
    0x94: 0x201d,
    0x95: 0x2022,
    0x96: 0x2013,
    0x97: 0x2014,
    0x98: 0x02dc,
    0x99: 0x2122,
    0x9a: 0x0161,
    0x9b: 0x203a,
    0x9c: 0x0153,
    0x9e: 0x017e,
    0x9f: 0x0178
};
