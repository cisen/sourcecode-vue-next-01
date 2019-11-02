import { isObject, toRawType } from '@vue/shared';
import { mutableHandlers, readonlyHandlers } from './baseHandlers';
import { mutableCollectionHandlers, readonlyCollectionHandlers } from './collectionHandlers';
import { makeMap } from '@vue/shared';
export const targetMap = new WeakMap();
// WeakMaps that store {raw <-> observed} pairs.
const rawToReactive = new WeakMap();
const reactiveToRaw = new WeakMap();
const rawToReadonly = new WeakMap();
const readonlyToRaw = new WeakMap();
// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
const readonlyValues = new WeakSet();
const nonReactiveValues = new WeakSet();
const collectionTypes = new Set([Set, Map, WeakMap, WeakSet]);
const isObservableType = /*#__PURE__*/ makeMap('Object,Array,Map,Set,WeakMap,WeakSet');
const canObserve = (value) => {
    return (!value._isVue &&
        !value._isVNode &&
        isObservableType(toRawType(value)) &&
        !nonReactiveValues.has(value));
};
export function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (readonlyToRaw.has(target)) {
        return target;
    }
    // target is explicitly marked as readonly by user
    if (readonlyValues.has(target)) {
        return readonly(target);
    }
    return createReactiveObject(target, rawToReactive, reactiveToRaw, mutableHandlers, mutableCollectionHandlers);
}
export function readonly(target) {
    // value is a mutable observable, retrieve its original and return
    // a readonly version.
    if (reactiveToRaw.has(target)) {
        target = reactiveToRaw.get(target);
    }
    return createReactiveObject(target, rawToReadonly, readonlyToRaw, readonlyHandlers, readonlyCollectionHandlers);
}
function createReactiveObject(target, toProxy, toRaw, baseHandlers, collectionHandlers) {
    if (!isObject(target)) {
        if (__DEV__) {
            console.warn(`value cannot be made reactive: ${String(target)}`);
        }
        return target;
    }
    // target already has corresponding Proxy
    let observed = toProxy.get(target);
    if (observed !== void 0) {
        return observed;
    }
    // target is already a Proxy
    if (toRaw.has(target)) {
        return target;
    }
    // only a whitelist of value types can be observed.
    if (!canObserve(target)) {
        return target;
    }
    const handlers = collectionTypes.has(target.constructor)
        ? collectionHandlers
        : baseHandlers;
    observed = new Proxy(target, handlers);
    toProxy.set(target, observed);
    toRaw.set(observed, target);
    if (!targetMap.has(target)) {
        targetMap.set(target, new Map());
    }
    return observed;
}
export function isReactive(value) {
    return reactiveToRaw.has(value) || readonlyToRaw.has(value);
}
export function isReadonly(value) {
    return readonlyToRaw.has(value);
}
export function toRaw(observed) {
    return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed;
}
export function markReadonly(value) {
    readonlyValues.add(value);
    return value;
}
export function markNonReactive(value) {
    nonReactiveValues.add(value);
    return value;
}
