import { patchClass } from './modules/class';
import { patchStyle } from './modules/style';
import { patchAttr } from './modules/attrs';
import { patchDOMProp } from './modules/props';
import { patchEvent } from './modules/events';
import { isOn } from '@vue/shared';
export function patchProp(el, key, nextValue, prevValue, isSVG, prevChildren, parentComponent, parentSuspense, unmountChildren) {
    switch (key) {
        // special
        case 'class':
            patchClass(el, nextValue, isSVG);
            break;
        case 'style':
            patchStyle(el, prevValue, nextValue);
            break;
        case 'modelValue':
        case 'onUpdate:modelValue':
            // Do nothing. This is handled by v-model directives.
            break;
        default:
            if (isOn(key)) {
                patchEvent(el, key.slice(2).toLowerCase(), prevValue, nextValue, parentComponent);
            }
            else if (!isSVG && key in el) {
                patchDOMProp(el, key, nextValue, prevChildren, parentComponent, parentSuspense, unmountChildren);
            }
            else {
                patchAttr(el, key, nextValue);
            }
            break;
    }
}
