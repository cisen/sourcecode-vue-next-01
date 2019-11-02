import { toRaw, reactive, readonly } from './reactive';
import { track, trigger } from './effect';
import { LOCKED } from './lock';
import { isObject, capitalize, hasOwn, hasChanged } from '@vue/shared';
const toReactive = (value) => isObject(value) ? reactive(value) : value;
const toReadonly = (value) => isObject(value) ? readonly(value) : value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function get(target, key, wrap) {
    target = toRaw(target);
    key = toRaw(key);
    track(target, "get" /* GET */, key);
    return wrap(getProto(target).get.call(target, key));
}
function has(key) {
    const target = toRaw(this);
    key = toRaw(key);
    track(target, "has" /* HAS */, key);
    return getProto(target).has.call(target, key);
}
function size(target) {
    target = toRaw(target);
    track(target, "iterate" /* ITERATE */);
    return Reflect.get(getProto(target), 'size', target);
}
function add(value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, value);
    const result = proto.add.call(target, value);
    if (!hadKey) {
        /* istanbul ignore else */
        if (__DEV__) {
            trigger(target, "add" /* ADD */, value, { newValue: value });
        }
        else {
            trigger(target, "add" /* ADD */, value);
        }
    }
    return result;
}
function set(key, value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, key);
    const oldValue = proto.get.call(target, key);
    const result = proto.set.call(target, key, value);
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
    return result;
}
function deleteEntry(key) {
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, key);
    const oldValue = proto.get ? proto.get.call(target, key) : undefined;
    // forward the operation before queueing reactions
    const result = proto.delete.call(target, key);
    if (hadKey) {
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
function clear() {
    const target = toRaw(this);
    const hadItems = target.size !== 0;
    const oldTarget = __DEV__
        ? target instanceof Map
            ? new Map(target)
            : new Set(target)
        : undefined;
    // forward the operation before queueing reactions
    const result = getProto(target).clear.call(target);
    if (hadItems) {
        /* istanbul ignore else */
        if (__DEV__) {
            trigger(target, "clear" /* CLEAR */, void 0, { oldTarget });
        }
        else {
            trigger(target, "clear" /* CLEAR */);
        }
    }
    return result;
}
function createForEach(isReadonly) {
    return function forEach(callback, thisArg) {
        const observed = this;
        const target = toRaw(observed);
        const wrap = isReadonly ? toReadonly : toReactive;
        track(target, "iterate" /* ITERATE */);
        // important: create sure the callback is
        // 1. invoked with the reactive map as `this` and 3rd arg
        // 2. the value received should be a corresponding reactive/readonly.
        function wrappedCallback(value, key) {
            return callback.call(observed, wrap(value), wrap(key), observed);
        }
        return getProto(target).forEach.call(target, wrappedCallback, thisArg);
    };
}
function createIterableMethod(method, isReadonly) {
    return function (...args) {
        const target = toRaw(this);
        const isPair = method === 'entries' ||
            (method === Symbol.iterator && target instanceof Map);
        const innerIterator = getProto(target)[method].apply(target, args);
        const wrap = isReadonly ? toReadonly : toReactive;
        track(target, "iterate" /* ITERATE */);
        // return a wrapped iterator which returns observed versions of the
        // values emitted from the real iterator
        return {
            // iterator protocol
            next() {
                const { value, done } = innerIterator.next();
                return done
                    ? { value, done }
                    : {
                        value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                        done
                    };
            },
            // iterable protocol
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
function createReadonlyMethod(method, type) {
    return function (...args) {
        if (LOCKED) {
            if (__DEV__) {
                const key = args[0] ? `on key "${args[0]}" ` : ``;
                console.warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
            }
            return type === "delete" /* DELETE */ ? false : this;
        }
        else {
            return method.apply(this, args);
        }
    };
}
const mutableInstrumentations = {
    get(key) {
        return get(this, key, toReactive);
    },
    get size() {
        return size(this);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false)
};
const readonlyInstrumentations = {
    get(key) {
        return get(this, key, toReadonly);
    },
    get size() {
        return size(this);
    },
    has,
    add: createReadonlyMethod(add, "add" /* ADD */),
    set: createReadonlyMethod(set, "set" /* SET */),
    delete: createReadonlyMethod(deleteEntry, "delete" /* DELETE */),
    clear: createReadonlyMethod(clear, "clear" /* CLEAR */),
    forEach: createForEach(true)
};
const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
iteratorMethods.forEach(method => {
    mutableInstrumentations[method] = createIterableMethod(method, false);
    readonlyInstrumentations[method] = createIterableMethod(method, true);
});
function createInstrumentationGetter(instrumentations) {
    return (target, key, receiver) => Reflect.get(hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target, key, receiver);
}
export const mutableCollectionHandlers = {
    get: createInstrumentationGetter(mutableInstrumentations)
};
export const readonlyCollectionHandlers = {
    get: createInstrumentationGetter(readonlyInstrumentations)
};
