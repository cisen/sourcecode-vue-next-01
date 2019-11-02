import { logNodeOp } from './nodeOps';
import { isOn } from '@vue/shared';
export function patchProp(el, key, nextValue, prevValue) {
    logNodeOp({
        type: "patch" /* PATCH */,
        targetNode: el,
        propKey: key,
        propPrevValue: prevValue,
        propNextValue: nextValue
    });
    el.props[key] = nextValue;
    if (isOn(key)) {
        const event = key.slice(2).toLowerCase();
        (el.eventListeners || (el.eventListeners = {}))[event] = nextValue;
    }
}
