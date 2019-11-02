import { reactive, readonly, toRaw } from './reactive';
import { track, trigger } from './effect';
import { LOCKED } from './lock';
import { isObject, hasOwn, isSymbol, hasChanged } from '@vue/shared';
import { isRef } from './ref';
const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(isSymbol));
function createGetter(isReadonly) {
    return function get(target, key, receiver) {
        const res = Reflect.get(target, key, receiver);
        if (isSymbol(key) && builtInSymbols.has(key)) {
            return res;
        }
        if (isRef(res)) {
            return res.value;
        }
        track(target, "get" /* GET */, key);
        return isObject(res)
            ? isReadonly
                ? // need to lazy access readonly and reactive here to avoid
                    // circular dependency
                    readonly(res)
                : reactive(res)
            : res;
    };
}
function set(target, key, value, receiver) {
    value = toRaw(value);
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
    }
    const hadKey = hasOwn(target, key);
    const result = Reflect.set(target, key, value, receiver);
    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
        /* istanbul ignore else */
        if (__DEV__) {
            const extraInfo = { oldValue, newValue: value };
            if (!hadKey) {
                trigger(target, "add" /* ADD */, key, extraInfo);
            }
            else if (hasChanged(value, oldValue)) {
                trigger(target, "set" /* SET */, key, extraInfo);
            }
        }
        else {
            if (!hadKey) {
                trigger(target, "add" /* ADD */, key);
            }
            else if (hasChanged(value, oldValue)) {
                trigger(target, "set" /* SET */, key);
            }
        }
    }
    return result;
}
function deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
        /* istanbul ignore else */
        if (__DEV__) {
            trigger(target, "delete" /* DELETE */, key, { oldValue });
        }
        else {
            trigger(target, "delete" /* DELETE */, key);
        }
    }
    return result;
}
function has(target, key) {
    const result = Reflect.has(target, key);
    track(target, "has" /* HAS */, key);
    return result;
}
function ownKeys(target) {
    track(target, "iterate" /* ITERATE */);
    return Reflect.ownKeys(target);
}
export const mutableHandlers = {
    get: createGetter(false),
    set,
    deleteProperty,
    has,
    ownKeys
};
export const readonlyHandlers = {
    get: createGetter(true),
    set(target, key, value, receiver) {
        if (LOCKED) {
            if (__DEV__) {
                console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
            }
            return true;
        }
        else {
            return set(target, key, value, receiver);
        }
    },
    deleteProperty(target, key) {
        if (LOCKED) {
            if (__DEV__) {
                console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
            }
            return true;
        }
        else {
            return deleteProperty(target, key);
        }
    },
    has,
    ownKeys
};
