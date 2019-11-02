export function defaultOnError(error) {
    throw error;
}
export function createCompilerError(code, loc, messages) {
    const msg = __DEV__ || !__BROWSER__ ? (messages || errorMessages)[code] : code;
    const locInfo = loc ? ` (${loc.start.line}:${loc.start.column})` : ``;
    const error = new SyntaxError(msg + locInfo);
    error.code = code;
    error.loc = loc;
    return error;
}
export const errorMessages = {
    // parse errors
    [0 /* ABRUPT_CLOSING_OF_EMPTY_COMMENT */]: 'Illegal comment.',
    [1 /* ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE */]: 'Illegal numeric character reference: invalid character.',
    [2 /* CDATA_IN_HTML_CONTENT */]: 'CDATA section is allowed only in XML context.',
    [3 /* CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE */]: 'Illegal numeric character reference: too big.',
    [4 /* CONTROL_CHARACTER_REFERENCE */]: 'Illegal numeric character reference: control character.',
    [5 /* DUPLICATE_ATTRIBUTE */]: 'Duplicate attribute.',
    [6 /* END_TAG_WITH_ATTRIBUTES */]: 'End tag cannot have attributes.',
    [7 /* END_TAG_WITH_TRAILING_SOLIDUS */]: "Illegal '/' in tags.",
    [8 /* EOF_BEFORE_TAG_NAME */]: 'Unexpected EOF in tag.',
    [9 /* EOF_IN_CDATA */]: 'Unexpected EOF in CDATA section.',
    [10 /* EOF_IN_COMMENT */]: 'Unexpected EOF in comment.',
    [11 /* EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT */]: 'Unexpected EOF in script.',
    [12 /* EOF_IN_TAG */]: 'Unexpected EOF in tag.',
    [13 /* INCORRECTLY_CLOSED_COMMENT */]: 'Incorrectly closed comment.',
    [14 /* INCORRECTLY_OPENED_COMMENT */]: 'Incorrectly opened comment.',
    [15 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */]: "Illegal tag name. Use '&lt;' to print '<'.",
    [16 /* MISSING_ATTRIBUTE_VALUE */]: 'Attribute value was expected.',
    [17 /* MISSING_END_TAG_NAME */]: 'End tag name was expected.',
    [18 /* MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE */]: 'Semicolon was expected.',
    [19 /* MISSING_WHITESPACE_BETWEEN_ATTRIBUTES */]: 'Whitespace was expected.',
    [20 /* NESTED_COMMENT */]: "Unexpected '<!--' in comment.",
    [21 /* NONCHARACTER_CHARACTER_REFERENCE */]: 'Illegal numeric character reference: non character.',
    [22 /* NULL_CHARACTER_REFERENCE */]: 'Illegal numeric character reference: null character.',
    [23 /* SURROGATE_CHARACTER_REFERENCE */]: 'Illegal numeric character reference: non-pair surrogate.',
    [24 /* UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME */]: 'Attribute name cannot contain U+0022 ("), U+0027 (\'), and U+003C (<).',
    [25 /* UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE */]: 'Unquoted attribute value cannot contain U+0022 ("), U+0027 (\'), U+003C (<), U+003D (=), and U+0060 (`).',
    [26 /* UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME */]: "Attribute name cannot start with '='.",
    [28 /* UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME */]: "'<?' is allowed only in XML context.",
    [29 /* UNEXPECTED_SOLIDUS_IN_TAG */]: "Illegal '/' in tags.",
    [30 /* UNKNOWN_NAMED_CHARACTER_REFERENCE */]: 'Unknown entity name.',
    // Vue-specific parse errors
    [31 /* X_INVALID_END_TAG */]: 'Invalid end tag.',
    [32 /* X_MISSING_END_TAG */]: 'End tag was not found.',
    [33 /* X_MISSING_INTERPOLATION_END */]: 'Interpolation end sign was not found.',
    [34 /* X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END */]: 'End bracket for dynamic directive argument was not found. ' +
        'Note that dynamic directive argument cannot contain spaces.',
    // transform errors
    [35 /* X_V_IF_NO_EXPRESSION */]: `v-if/v-else-if is missing expression.`,
    [36 /* X_V_ELSE_NO_ADJACENT_IF */]: `v-else/v-else-if has no adjacent v-if.`,
    [37 /* X_V_FOR_NO_EXPRESSION */]: `v-for is missing expression.`,
    [38 /* X_V_FOR_MALFORMED_EXPRESSION */]: `v-for has invalid expression.`,
    [39 /* X_V_BIND_NO_EXPRESSION */]: `v-bind is missing expression.`,
    [40 /* X_V_ON_NO_EXPRESSION */]: `v-on is missing expression.`,
    [41 /* X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET */]: `Unexpected custom directive on <slot> outlet.`,
    [42 /* X_V_SLOT_NAMED_SLOT_ON_COMPONENT */]: `Named v-slot on component. ` +
        `Named slots should use <template v-slot> syntax nested inside the component.`,
    [43 /* X_V_SLOT_MIXED_SLOT_USAGE */]: `Mixed v-slot usage on both the component and nested <template>.` +
        `The default slot should also use <template> syntax when there are other ` +
        `named slots to avoid scope ambiguity.`,
    [44 /* X_V_SLOT_DUPLICATE_SLOT_NAMES */]: `Duplicate slot names found. `,
    [45 /* X_V_SLOT_EXTRANEOUS_NON_SLOT_CHILDREN */]: `Extraneous children found when component has explicit slots. ` +
        `These children will be ignored.`,
    [46 /* X_V_SLOT_MISPLACED */]: `v-slot can only be used on components or <template> tags.`,
    [47 /* X_V_MODEL_NO_EXPRESSION */]: `v-model is missing expression.`,
    [48 /* X_V_MODEL_MALFORMED_EXPRESSION */]: `v-model value must be a valid JavaScript member expression.`,
    [49 /* X_V_MODEL_ON_SCOPE_VARIABLE */]: `v-model cannot be used on v-for or v-slot scope variables because they are not writable.`,
    [50 /* X_INVALID_EXPRESSION */]: `Invalid JavaScript expression.`,
    // generic errors
    [51 /* X_PREFIX_ID_NOT_SUPPORTED */]: `"prefixIdentifiers" option is not supported in this build of compiler.`,
    [52 /* X_MODULE_MODE_NOT_SUPPORTED */]: `ES module mode is not supported in this build of compiler.`
};
