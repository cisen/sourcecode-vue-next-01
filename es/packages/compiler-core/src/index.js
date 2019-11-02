import { parse } from './parse';
import { transform } from './transform';
import { generate } from './codegen';
import { isString } from '@vue/shared';
import { transformIf } from './transforms/vIf';
import { transformFor } from './transforms/vFor';
import { transformExpression } from './transforms/transformExpression';
import { transformSlotOutlet } from './transforms/transformSlotOutlet';
import { transformElement } from './transforms/transformElement';
import { transformOn } from './transforms/vOn';
import { transformBind } from './transforms/vBind';
import { defaultOnError, createCompilerError } from './errors';
import { trackSlotScopes, trackVForSlotScopes } from './transforms/vSlot';
import { transformText } from './transforms/transformText';
import { transformOnce } from './transforms/vOnce';
import { transformModel } from './transforms/vModel';
// we name it `baseCompile` so that higher order compilers like @vue/compiler-dom
// can export `compile` while re-exporting everything else.
export function baseCompile(template, options = {}) {
    /* istanbul ignore if */
    if (__BROWSER__) {
        const onError = options.onError || defaultOnError;
        if (options.prefixIdentifiers === true) {
            onError(createCompilerError(51 /* X_PREFIX_ID_NOT_SUPPORTED */));
        }
        else if (options.mode === 'module') {
            onError(createCompilerError(52 /* X_MODULE_MODE_NOT_SUPPORTED */));
        }
    }
    const ast = isString(template) ? parse(template, options) : template;
    const prefixIdentifiers = !__BROWSER__ &&
        (options.prefixIdentifiers === true || options.mode === 'module');
    transform(ast, {
        ...options,
        prefixIdentifiers,
        nodeTransforms: [
            transformOnce,
            transformIf,
            transformFor,
            ...(prefixIdentifiers
                ? [
                    // order is important
                    trackVForSlotScopes,
                    transformExpression
                ]
                : []),
            transformSlotOutlet,
            transformElement,
            trackSlotScopes,
            transformText,
            ...(options.nodeTransforms || []) // user transforms
        ],
        directiveTransforms: {
            on: transformOn,
            bind: transformBind,
            model: transformModel,
            ...(options.directiveTransforms || {}) // user transforms
        }
    });
    return generate(ast, {
        ...options,
        prefixIdentifiers
    });
}
// Also expose lower level APIs & types
export { parse } from './parse';
export { transform, createStructuralDirectiveTransform } from './transform';
export { generate } from './codegen';
export { createCompilerError } from './errors';
export * from './ast';
export * from './utils';
export * from './codeframe';
export { registerRuntimeHelpers } from './runtimeHelpers';
// expose transforms so higher-order compilers can import and extend them
export { transformModel } from './transforms/vModel';
export { transformOn } from './transforms/vOn';
