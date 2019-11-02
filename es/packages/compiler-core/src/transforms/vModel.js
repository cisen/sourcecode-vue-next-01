import { createSimpleExpression, createObjectProperty, createCompoundExpression } from '../ast';
import { createCompilerError } from '../errors';
import { isMemberExpression, isSimpleIdentifier, hasScopeRef } from '../utils';
export const transformModel = (dir, node, context) => {
    const { exp, arg } = dir;
    if (!exp) {
        context.onError(createCompilerError(47 /* X_V_MODEL_NO_EXPRESSION */, dir.loc));
        return createTransformProps();
    }
    const expString = exp.type === 4 /* SIMPLE_EXPRESSION */ ? exp.content : exp.loc.source;
    if (!isMemberExpression(expString)) {
        context.onError(createCompilerError(48 /* X_V_MODEL_MALFORMED_EXPRESSION */, exp.loc));
        return createTransformProps();
    }
    if (!__BROWSER__ &&
        context.prefixIdentifiers &&
        isSimpleIdentifier(expString) &&
        context.identifiers[expString]) {
        context.onError(createCompilerError(49 /* X_V_MODEL_ON_SCOPE_VARIABLE */, exp.loc));
        return createTransformProps();
    }
    const propName = arg ? arg : createSimpleExpression('modelValue', true);
    const eventName = arg
        ? arg.type === 4 /* SIMPLE_EXPRESSION */ && arg.isStatic
            ? createSimpleExpression('onUpdate:' + arg.content, true)
            : createCompoundExpression([
                createSimpleExpression('onUpdate:', true),
                '+',
                ...(arg.type === 4 /* SIMPLE_EXPRESSION */ ? [arg] : arg.children)
            ])
        : createSimpleExpression('onUpdate:modelValue', true);
    const props = [
        // modelValue: foo
        createObjectProperty(propName, dir.exp),
        // "onUpdate:modelValue": $event => (foo = $event)
        createObjectProperty(eventName, createCompoundExpression([
            `$event => (`,
            ...(exp.type === 4 /* SIMPLE_EXPRESSION */ ? [exp] : exp.children),
            ` = $event)`
        ]))
    ];
    // cache v-model handler if applicable (when it doesn't refer any scope vars)
    if (!__BROWSER__ &&
        context.prefixIdentifiers &&
        context.cacheHandlers &&
        !hasScopeRef(exp, context.identifiers)) {
        props[1].value = context.cache(props[1].value);
    }
    // modelModifiers: { foo: true, "bar-baz": true }
    if (dir.modifiers.length && node.tagType === 1 /* COMPONENT */) {
        const modifiers = dir.modifiers
            .map(m => (isSimpleIdentifier(m) ? m : JSON.stringify(m)) + `: true`)
            .join(`, `);
        props.push(createObjectProperty(`modelModifiers`, createSimpleExpression(`{ ${modifiers} }`, false, dir.loc, true)));
    }
    return createTransformProps(props);
};
function createTransformProps(props = []) {
    return { props, needRuntime: false };
}
