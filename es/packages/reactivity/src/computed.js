import { effect, effectStack } from './effect';
import { isFunction, NOOP } from '@vue/shared';
export function computed(getterOrOptions) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter = __DEV__
            ? () => {
                console.warn('Write operation failed: computed value is readonly');
            }
            : NOOP;
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    let dirty = true;
    let value;
    const runner = effect(getter, {
        lazy: true,
        // mark effect as computed so that it gets priority during trigger
        computed: true,
        scheduler: () => {
            dirty = true;
        }
    });
    return {
        _isRef: true,
        // expose effect so computed can be stopped
        effect: runner,
        get value() {
            if (dirty) {
                value = runner();
                dirty = false;
            }
            // When computed effects are accessed in a parent effect, the parent
            // should track all the dependencies the computed property has tracked.
            // This should also apply for chained computed properties.
            trackChildRun(runner);
            return value;
        },
        set value(newValue) {
            setter(newValue);
        }
    };
}
function trackChildRun(childRunner) {
    if (effectStack.length === 0) {
        return;
    }
    const parentRunner = effectStack[effectStack.length - 1];
    for (let i = 0; i < childRunner.deps.length; i++) {
        const dep = childRunner.deps[i];
        if (!dep.has(parentRunner)) {
            dep.add(parentRunner);
            parentRunner.deps.push(dep);
        }
    }
}
