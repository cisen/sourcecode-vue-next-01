import { createObjectExpression, createObjectProperty, createSimpleExpression, createFunctionExpression, createConditionalExpression, createCallExpression, createArrayExpression } from '../ast';
import { createCompilerError } from '../errors';
import { findDir, isTemplateNode, assert, isVSlot, hasScopeRef } from '../utils';
import { CREATE_SLOTS, RENDER_LIST } from '../runtimeHelpers';
import { parseForExpression, createForLoopParams } from './vFor';
const isStaticExp = (p) => p.type === 4 /* SIMPLE_EXPRESSION */ && p.isStatic;
const defaultFallback = createSimpleExpression(`undefined`, false);
// A NodeTransform that:
// 1. Tracks scope identifiers for scoped slots so that they don't get prefixed
//    by transformExpression. This is only applied in non-browser builds with
//    { prefixIdentifiers: true }.
// 2. Track v-slot depths so that we know a slot is inside another slot.
//    Note the exit callback is executed before buildSlots() on the same node,
//    so only nested slots see positive numbers.
export const trackSlotScopes = (node, context) => {
    if (node.type === 1 /* ELEMENT */ &&
        (node.tagType === 1 /* COMPONENT */ ||
            node.tagType === 3 /* TEMPLATE */)) {
        // We are only checking non-empty v-slot here
        // since we only care about slots that introduce scope variables.
        const vSlot = findDir(node, 'slot');
        if (vSlot) {
            const slotProps = vSlot.exp;
            if (!__BROWSER__ && context.prefixIdentifiers) {
                slotProps && context.addIdentifiers(slotProps);
            }
            context.scopes.vSlot++;
            return () => {
                if (!__BROWSER__ && context.prefixIdentifiers) {
                    slotProps && context.removeIdentifiers(slotProps);
                }
                context.scopes.vSlot--;
            };
        }
    }
};
// A NodeTransform that tracks scope identifiers for scoped slots with v-for.
// This transform is only applied in non-browser builds with { prefixIdentifiers: true }
export const trackVForSlotScopes = (node, context) => {
    let vFor;
    if (isTemplateNode(node) &&
        node.props.some(isVSlot) &&
        (vFor = findDir(node, 'for'))) {
        const result = (vFor.parseResult = parseForExpression(vFor.exp, context));
        if (result) {
            const { value, key, index } = result;
            const { addIdentifiers, removeIdentifiers } = context;
            value && addIdentifiers(value);
            key && addIdentifiers(key);
            index && addIdentifiers(index);
            return () => {
                value && removeIdentifiers(value);
                key && removeIdentifiers(key);
                index && removeIdentifiers(index);
            };
        }
    }
};
// Instead of being a DirectiveTransform, v-slot processing is called during
// transformElement to build the slots object for a component.
export function buildSlots(node, context) {
    const { children, loc } = node;
    const slotsProperties = [];
    const dynamicSlots = [];
    // If the slot is inside a v-for or another v-slot, force it to be dynamic
    // since it likely uses a scope variable.
    let hasDynamicSlots = context.scopes.vSlot > 0 || context.scopes.vFor > 0;
    // with `prefixIdentifiers: true`, this can be further optimized to make
    // it dynamic only when the slot actually uses the scope variables.
    if (!__BROWSER__ && context.prefixIdentifiers) {
        hasDynamicSlots = hasScopeRef(node, context.identifiers);
    }
    // 1. Check for default slot with slotProps on component itself.
    //    <Comp v-slot="{ prop }"/>
    const explicitDefaultSlot = findDir(node, 'slot', true);
    if (explicitDefaultSlot) {
        const { arg, exp, loc } = explicitDefaultSlot;
        if (arg) {
            context.onError(createCompilerError(42 /* X_V_SLOT_NAMED_SLOT_ON_COMPONENT */, loc));
        }
        slotsProperties.push(buildDefaultSlot(exp, children, loc));
    }
    // 2. Iterate through children and check for template slots
    //    <template v-slot:foo="{ prop }">
    let hasTemplateSlots = false;
    let extraneousChild = undefined;
    const seenSlotNames = new Set();
    for (let i = 0; i < children.length; i++) {
        const slotElement = children[i];
        let slotDir;
        if (!isTemplateNode(slotElement) ||
            !(slotDir = findDir(slotElement, 'slot', true))) {
            // not a <template v-slot>, skip.
            if (slotElement.type !== 3 /* COMMENT */ && !extraneousChild) {
                extraneousChild = slotElement;
            }
            continue;
        }
        if (explicitDefaultSlot) {
            // already has on-component default slot - this is incorrect usage.
            context.onError(createCompilerError(43 /* X_V_SLOT_MIXED_SLOT_USAGE */, slotDir.loc));
            break;
        }
        hasTemplateSlots = true;
        const { children: slotChildren, loc: slotLoc } = slotElement;
        const { arg: slotName = createSimpleExpression(`default`, true), exp: slotProps, loc: dirLoc } = slotDir;
        // check if name is dynamic.
        let staticSlotName;
        if (isStaticExp(slotName)) {
            staticSlotName = slotName ? slotName.content : `default`;
        }
        else {
            hasDynamicSlots = true;
        }
        const slotFunction = createFunctionExpression(slotProps, slotChildren, false, slotChildren.length ? slotChildren[0].loc : slotLoc);
        // check if this slot is conditional (v-if/v-for)
        let vIf;
        let vElse;
        let vFor;
        if ((vIf = findDir(slotElement, 'if'))) {
            hasDynamicSlots = true;
            dynamicSlots.push(createConditionalExpression(vIf.exp, buildDynamicSlot(slotName, slotFunction), defaultFallback));
        }
        else if ((vElse = findDir(slotElement, /^else(-if)?$/, true /* allowEmpty */))) {
            // find adjacent v-if
            let j = i;
            let prev;
            while (j--) {
                prev = children[j];
                if (prev.type !== 3 /* COMMENT */) {
                    break;
                }
            }
            if (prev && isTemplateNode(prev) && findDir(prev, 'if')) {
                // remove node
                children.splice(i, 1);
                i--;
                __DEV__ && assert(dynamicSlots.length > 0);
                // attach this slot to previous conditional
                let conditional = dynamicSlots[dynamicSlots.length - 1];
                while (conditional.alternate.type === 19 /* JS_CONDITIONAL_EXPRESSION */) {
                    conditional = conditional.alternate;
                }
                conditional.alternate = vElse.exp
                    ? createConditionalExpression(vElse.exp, buildDynamicSlot(slotName, slotFunction), defaultFallback)
                    : buildDynamicSlot(slotName, slotFunction);
            }
            else {
                context.onError(createCompilerError(36 /* X_V_ELSE_NO_ADJACENT_IF */, vElse.loc));
            }
        }
        else if ((vFor = findDir(slotElement, 'for'))) {
            hasDynamicSlots = true;
            const parseResult = vFor.parseResult ||
                parseForExpression(vFor.exp, context);
            if (parseResult) {
                // Render the dynamic slots as an array and add it to the createSlot()
                // args. The runtime knows how to handle it appropriately.
                dynamicSlots.push(createCallExpression(context.helper(RENDER_LIST), [
                    parseResult.source,
                    createFunctionExpression(createForLoopParams(parseResult), buildDynamicSlot(slotName, slotFunction), true)
                ]));
            }
            else {
                context.onError(createCompilerError(38 /* X_V_FOR_MALFORMED_EXPRESSION */, vFor.loc));
            }
        }
        else {
            // check duplicate static names
            if (staticSlotName) {
                if (seenSlotNames.has(staticSlotName)) {
                    context.onError(createCompilerError(44 /* X_V_SLOT_DUPLICATE_SLOT_NAMES */, dirLoc));
                    continue;
                }
                seenSlotNames.add(staticSlotName);
            }
            slotsProperties.push(createObjectProperty(slotName, slotFunction));
        }
    }
    if (hasTemplateSlots && extraneousChild) {
        context.onError(createCompilerError(45 /* X_V_SLOT_EXTRANEOUS_NON_SLOT_CHILDREN */, extraneousChild.loc));
    }
    if (!explicitDefaultSlot && !hasTemplateSlots) {
        // implicit default slot.
        slotsProperties.push(buildDefaultSlot(undefined, children, loc));
    }
    let slots = createObjectExpression(slotsProperties.concat(createObjectProperty(`_compiled`, createSimpleExpression(`true`, false))), loc);
    if (dynamicSlots.length) {
        slots = createCallExpression(context.helper(CREATE_SLOTS), [
            slots,
            createArrayExpression(dynamicSlots)
        ]);
    }
    return {
        slots,
        hasDynamicSlots
    };
}
function buildDefaultSlot(slotProps, children, loc) {
    return createObjectProperty(`default`, createFunctionExpression(slotProps, children, false, children.length ? children[0].loc : loc));
}
function buildDynamicSlot(name, fn) {
    return createObjectExpression([
        createObjectProperty(`name`, name),
        createObjectProperty(`fn`, fn)
    ]);
}