import { createCompilerError } from '@vue/compiler-core';
export function createDOMCompilerError(code, loc) {
    return createCompilerError(code, loc, __DEV__ || !__BROWSER__ ? DOMErrorMessages : undefined);
}
export const DOMErrorMessages = {
    [53 /* X_V_HTML_NO_EXPRESSION */]: `v-html is missing expression.`,
    [54 /* X_V_HTML_WITH_CHILDREN */]: `v-html will override element children.`,
    [55 /* X_V_TEXT_NO_EXPRESSION */]: `v-text is missing expression.`,
    [56 /* X_V_TEXT_WITH_CHILDREN */]: `v-text will override element children.`,
    [57 /* X_V_MODEL_ON_INVALID_ELEMENT */]: `v-model can only be used on <input>, <textarea> and <select> elements.`,
    [58 /* X_V_MODEL_ARG_ON_ELEMENT */]: `v-model argument is not supported on plain elements.`,
    [59 /* X_V_MODEL_ON_FILE_INPUT_ELEMENT */]: `v-model cannot used on file inputs since they are read-only. Use a v-on:change listener instead.`
};
