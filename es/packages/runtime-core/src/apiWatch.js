import { effect, stop, isRef } from '@vue/reactivity';
import { queueJob } from './scheduler';
import { EMPTY_OBJ, isObject, isArray, isFunction, isString, hasChanged } from '@vue/shared';
import { recordEffect } from './apiReactivity';
import { currentInstance, currentSuspense } from './component';
import { callWithErrorHandling, callWithAsyncErrorHandling } from './errorHandling';
import { onBeforeUnmount } from './apiLifecycle';
import { queuePostRenderEffect } from './createRenderer';
const invoke = (fn) => fn();
// implementation
export function watch(effectOrSource, cbOrOptions, options) {
    if (isFunction(cbOrOptions)) {
        // effect callback as 2nd argument - this is a source watcher
        return doWatch(effectOrSource, cbOrOptions, options);
    }
    else {
        // 2nd argument is either missing or an options object
        // - this is a simple effect watcher
        return doWatch(effectOrSource, null, cbOrOptions);
    }
}
function doWatch(source, cb, { lazy, deep, flush, onTrack, onTrigger } = EMPTY_OBJ) {
    const instance = currentInstance;
    const suspense = currentSuspense;
    let getter;
    if (isArray(source)) {
        getter = () => source.map(s => isRef(s)
            ? s.value
            : callWithErrorHandling(s, instance, 2 /* WATCH_GETTER */));
    }
    else if (isRef(source)) {
        getter = () => source.value;
    }
    else if (cb) {
        // getter with cb
        getter = () => callWithErrorHandling(source, instance, 2 /* WATCH_GETTER */);
    }
    else {
        // no cb -> simple effect
        getter = () => {
            if (instance && instance.isUnmounted) {
                return;
            }
            if (cleanup) {
                cleanup();
            }
            return callWithErrorHandling(source, instance, 3 /* WATCH_CALLBACK */, [registerCleanup]);
        };
    }
    if (deep) {
        const baseGetter = getter;
        getter = () => traverse(baseGetter());
    }
    let cleanup;
    const registerCleanup = (fn) => {
        cleanup = runner.options.onStop = () => {
            callWithErrorHandling(fn, instance, 4 /* WATCH_CLEANUP */);
        };
    };
    let oldValue = isArray(source) ? [] : undefined;
    const applyCb = cb
        ? () => {
            if (instance && instance.isUnmounted) {
                return;
            }
            const newValue = runner();
            if (deep || hasChanged(newValue, oldValue)) {
                // cleanup before running cb again
                if (cleanup) {
                    cleanup();
                }
                callWithAsyncErrorHandling(cb, instance, 3 /* WATCH_CALLBACK */, [
                    newValue,
                    oldValue,
                    registerCleanup
                ]);
                oldValue = newValue;
            }
        }
        : void 0;
    let scheduler;
    if (flush === 'sync') {
        scheduler = invoke;
    }
    else if (flush === 'pre') {
        scheduler = job => {
            if (!instance || instance.vnode.el != null) {
                queueJob(job);
            }
            else {
                // with 'pre' option, the first call must happen before
                // the component is mounted so it is called synchronously.
                job();
            }
        };
    }
    else {
        scheduler = job => {
            queuePostRenderEffect(job, suspense);
        };
    }
    const runner = effect(getter, {
        lazy: true,
        // so it runs before component update effects in pre flush mode
        computed: true,
        onTrack,
        onTrigger,
        scheduler: applyCb ? () => scheduler(applyCb) : scheduler
    });
    if (!lazy) {
        if (applyCb) {
            scheduler(applyCb);
        }
        else {
            scheduler(runner);
        }
    }
    else {
        oldValue = runner();
    }
    recordEffect(runner);
    return () => {
        stop(runner);
    };
}
// this.$watch
export function instanceWatch(source, cb, options) {
    const ctx = this.renderProxy;
    const getter = isString(source) ? () => ctx[source] : source.bind(ctx);
    const stop = watch(getter, cb.bind(ctx), options);
    onBeforeUnmount(stop, this);
    return stop;
}
function traverse(value, seen = new Set()) {
    if (!isObject(value) || seen.has(value)) {
        return;
    }
    seen.add(value);
    if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            traverse(value[i], seen);
        }
    }
    else if (value instanceof Map) {
        value.forEach((v, key) => {
            // to register mutation dep for existing keys
            traverse(value.get(key), seen);
        });
    }
    else if (value instanceof Set) {
        value.forEach(v => {
            traverse(v, seen);
        });
    }
    else {
        for (const key in value) {
            traverse(value[key], seen);
        }
    }
    return value;
}
