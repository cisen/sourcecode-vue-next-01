import { track, trigger } from './effect';
import { isObject } from '@vue/shared';
import { reactive } from './reactive';
const convert = (val) => isObject(val) ? reactive(val) : val;
export function ref(raw) {
    if (isRef(raw)) {
        return raw;
    }
    raw = convert(raw);
    const r = {
        _isRef: true,
        get value() {
            track(r, "get" /* GET */, '');
            return raw;
        },
        set value(newVal) {
            raw = convert(newVal);
            trigger(r, "set" /* SET */, '');
        }
    };
    return r;
}
export function isRef(r) {
    return r ? r._isRef === true : false;
}
export function toRefs(object) {
    const ret = {};
    for (const key in object) {
        ret[key] = toProxyRef(object, key);
    }
    return ret;
}
function toProxyRef(object, key) {
    return {
        _isRef: true,
        get value() {
            return object[key];
        },
        set value(newVal) {
            object[key] = newVal;
        }
    };
}
