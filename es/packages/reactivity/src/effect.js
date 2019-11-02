import { targetMap } from './reactive';
import { EMPTY_OBJ, extend } from '@vue/shared';
export const effectStack = [];
export const ITERATE_KEY = Symbol('iterate');
export function isEffect(fn) {
    return fn != null && fn._isEffect === true;
}
export function effect(fn, options = EMPTY_OBJ) {
    if (isEffect(fn)) {
        fn = fn.raw;
    }
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        effect();
    }
    return effect;
}
export function stop(effect) {
    if (effect.active) {
        cleanup(effect);
        if (effect.options.onStop) {
            effect.options.onStop();
        }
        effect.active = false;
    }
}
function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect(...args) {
        return run(effect, fn, args);
    };
    effect._isEffect = true;
    effect.active = true;
    effect.raw = fn;
    effect.deps = [];
    effect.options = options;
    return effect;
}
function run(effect, fn, args) {
    if (!effect.active) {
        return fn(...args);
    }
    if (!effectStack.includes(effect)) {
        cleanup(effect);
        try {
            effectStack.push(effect);
            return fn(...args);
        }
        finally {
            effectStack.pop();
        }
    }
}
function cleanup(effect) {
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
let shouldTrack = true;
export function pauseTracking() {
    shouldTrack = false;
}
export function resumeTracking() {
    shouldTrack = true;
}
export function track(target, type, key) {
    if (!shouldTrack || effectStack.length === 0) {
        return;
    }
    const effect = effectStack[effectStack.length - 1];
    if (type === "iterate" /* ITERATE */) {
        key = ITERATE_KEY;
    }
    let depsMap = targetMap.get(target);
    if (depsMap === void 0) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (dep === void 0) {
        depsMap.set(key, (dep = new Set()));
    }
    if (!dep.has(effect)) {
        dep.add(effect);
        effect.deps.push(dep);
        if (__DEV__ && effect.options.onTrack) {
            effect.options.onTrack({
                effect,
                target,
                type,
                key
            });
        }
    }
}
export function trigger(target, type, key, extraInfo) {
    const depsMap = targetMap.get(target);
    if (depsMap === void 0) {
        // never been tracked
        return;
    }
    const effects = new Set();
    const computedRunners = new Set();
    if (type === "clear" /* CLEAR */) {
        // collection being cleared, trigger all effects for target
        depsMap.forEach(dep => {
            addRunners(effects, computedRunners, dep);
        });
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            addRunners(effects, computedRunners, depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE
        if (type === "add" /* ADD */ || type === "delete" /* DELETE */) {
            const iterationKey = Array.isArray(target) ? 'length' : ITERATE_KEY;
            addRunners(effects, computedRunners, depsMap.get(iterationKey));
        }
    }
    const run = (effect) => {
        scheduleRun(effect, target, type, key, extraInfo);
    };
    // Important: computed effects must be run first so that computed getters
    // can be invalidated before any normal effects that depend on them are run.
    computedRunners.forEach(run);
    effects.forEach(run);
}
function addRunners(effects, computedRunners, effectsToAdd) {
    if (effectsToAdd !== void 0) {
        effectsToAdd.forEach(effect => {
            if (effect.options.computed) {
                computedRunners.add(effect);
            }
            else {
                effects.add(effect);
            }
        });
    }
}
function scheduleRun(effect, target, type, key, extraInfo) {
    if (__DEV__ && effect.options.onTrigger) {
        const event = {
            effect,
            target,
            key,
            type
        };
        effect.options.onTrigger(extraInfo ? extend(event, extraInfo) : event);
    }
    if (effect.options.scheduler !== void 0) {
        effect.options.scheduler(effect);
    }
    else {
        effect();
    }
}
