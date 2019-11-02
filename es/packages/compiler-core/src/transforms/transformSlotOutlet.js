import { createCallExpression } from '../ast';
import { isSlotOutlet } from '../utils';
import { buildProps } from './transformElement';
import { createCompilerError } from '../errors';
import { RENDER_SLOT } from '../runtimeHelpers';
export const transformSlotOutlet = (node, context) => {
    if (isSlotOutlet(node)) {
        const { props, children, loc } = node;
        const $slots = context.prefixIdentifiers ? `_ctx.$slots` : `$slots`;
        let slotName = `"default"`;
        // check for <slot name="xxx" OR :name="xxx" />
        let nameIndex = -1;
        for (let i = 0; i < props.length; i++) {
            const prop = props[i];
            if (prop.type === 6 /* ATTRIBUTE */) {
                if (prop.name === `name` && prop.value) {
                    // static name="xxx"
                    slotName = JSON.stringify(prop.value.content);
                    nameIndex = i;
                    break;
                }
            }
            else if (prop.name === `bind`) {
                const { arg, exp } = prop;
                if (arg &&
                    exp &&
                    arg.type === 4 /* SIMPLE_EXPRESSION */ &&
                    arg.isStatic &&
                    arg.content === `name`) {
                    // dynamic :name="xxx"
                    slotName = exp;
                    nameIndex = i;
                    break;
                }
            }
        }
        const slotArgs = [$slots, slotName];
        const propsWithoutName = nameIndex > -1
            ? props.slice(0, nameIndex).concat(props.slice(nameIndex + 1))
            : props;
        let hasProps = propsWithoutName.length > 0;
        if (hasProps) {
            const { props: propsExpression, directives } = buildProps(node, context, propsWithoutName);
            if (directives.length) {
                context.onError(createCompilerError(41 /* X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET */, directives[0].loc));
            }
            if (propsExpression) {
                slotArgs.push(propsExpression);
            }
            else {
                hasProps = false;
            }
        }
        if (children.length) {
            if (!hasProps) {
                slotArgs.push(`{}`);
            }
            slotArgs.push(children);
        }
        node.codegenNode = createCallExpression(context.helper(RENDER_SLOT), slotArgs, loc);
    }
};
