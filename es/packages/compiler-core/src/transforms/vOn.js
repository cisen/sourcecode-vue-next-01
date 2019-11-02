import { createObjectProperty, createSimpleExpression, createCompoundExpression } from '../ast';
import { capitalize } from '@vue/shared';
import { createCompilerError } from '../errors';
import { processExpression } from './transformExpression';
import { isMemberExpression, hasScopeRef } from '../utils';
const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function(?:\s+[\w$]+)?\s*\(/;
export const transformOn = (dir, node, context, augmentor) => {
    const { loc, modifiers, arg } = dir;
    if (!dir.exp && !modifiers.length) {
        context.onError(createCompilerError(40 /* X_V_ON_NO_EXPRESSION */, loc));
    }
    let eventName;
    if (arg.type === 4 /* SIMPLE_EXPRESSION */) {
        if (arg.isStatic) {
            eventName = createSimpleExpression(`on${capitalize(arg.content)}`, true, arg.loc);
        }
        else {
            eventName = createCompoundExpression([`"on" + (`, arg, `)`]);
        }
    }
    else {
        // already a compound expression.
        eventName = arg;
        eventName.children.unshift(`"on" + (`);
        eventName.children.push(`)`);
    }
    // handler processing
    let exp = dir.exp;
    let isCacheable = !exp;
    if (exp) {
        const isMemberExp = isMemberExpression(exp.content);
        const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content));
        // process the expression since it's been skipped
        if (!__BROWSER__ && context.prefixIdentifiers) {
            context.addIdentifiers(`$event`);
            exp = processExpression(exp, context);
            context.removeIdentifiers(`$event`);
            // with scope analysis, the function is hoistable if it has no reference
            // to scope variables.
            isCacheable =
                context.cacheHandlers && !hasScopeRef(exp, context.identifiers);
            // If the expression is optimizable and is a member expression pointing
            // to a function, turn it into invocation (and wrap in an arrow function
            // below) so that it always accesses the latest value when called - thus
            // avoiding the need to be patched.
            if (isCacheable && isMemberExp) {
                if (exp.type === 4 /* SIMPLE_EXPRESSION */) {
                    exp.content += `($event)`;
                }
                else {
                    exp.children.push(`($event)`);
                }
            }
        }
        if (isInlineStatement || (isCacheable && isMemberExp)) {
            // wrap inline statement in a function expression
            exp = createCompoundExpression([
                `$event => (`,
                ...(exp.type === 4 /* SIMPLE_EXPRESSION */ ? [exp] : exp.children),
                `)`
            ]);
        }
    }
    let ret = {
        props: [
            createObjectProperty(eventName, exp || createSimpleExpression(`() => {}`, false, loc))
        ],
        needRuntime: false
    };
    // apply extended compiler augmentor
    if (augmentor) {
        ret = augmentor(ret);
    }
    if (isCacheable) {
        // cache handlers so that it's always the same handler being passed down.
        // this avoids unnecessary re-renders when users use inline handlers on
        // components.
        ret.props[0].value = context.cache(ret.props[0].value);
    }
    return ret;
};
