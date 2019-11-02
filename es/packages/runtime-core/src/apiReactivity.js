export { ref, isRef, toRefs, reactive, isReactive, readonly, isReadonly, toRaw, markReadonly, markNonReactive, effect } from '@vue/reactivity';
import { computed as _computed } from '@vue/reactivity';
import { currentInstance } from './component';
// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
export function recordEffect(effect) {
    if (currentInstance) {
        ;
        (currentInstance.effects || (currentInstance.effects = [])).push(effect);
    }
}
export function computed(getterOrOptions) {
    const c = _computed(getterOrOptions);
    recordEffect(c.effect);
    return c;
}
