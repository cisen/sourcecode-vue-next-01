import { createObjectProperty, createSimpleExpression } from '../ast';
import { createCompilerError } from '../errors';
import { camelize } from '@vue/shared';
import { CAMELIZE } from '../runtimeHelpers';
// v-bind without arg is handled directly in ./transformElements.ts due to it affecting
// codegen for the entire props object. This transform here is only for v-bind
// *with* args.
export const transformBind = (dir, node, context) => {
    const { exp, modifiers, loc } = dir;
    const arg = dir.arg;
    if (!exp) {
        context.onError(createCompilerError(39 /* X_V_BIND_NO_EXPRESSION */, loc));
    }
    // .prop is no longer necessary due to new patch behavior
    // .sync is replaced by v-model:arg
    if (modifiers.includes('camel')) {
        if (arg.type === 4 /* SIMPLE_EXPRESSION */) {
            if (arg.isStatic) {
                arg.content = camelize(arg.content);
            }
            else {
                arg.content = `${context.helperString(CAMELIZE)}(${arg.content})`;
            }
        }
        else {
            arg.children.unshift(`${context.helperString(CAMELIZE)}(`);
            arg.children.push(`)`);
        }
    }
    return {
        props: [
            createObjectProperty(arg, exp || createSimpleExpression('', true, loc))
        ],
        needRuntime: false
    };
};
