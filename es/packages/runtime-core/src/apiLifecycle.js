import { currentInstance, setCurrentInstance } from './component';
import { callWithAsyncErrorHandling, ErrorTypeStrings } from './errorHandling';
import { warn } from './warning';
import { capitalize } from '@vue/shared';
import { pauseTracking, resumeTracking } from '@vue/reactivity';
export { onActivated, onDeactivated } from './keepAlive';
export function injectHook(type, hook, target = currentInstance, prepend = false) {
    if (target) {
        const hooks = target[type] || (target[type] = []);
        // cache the error handling wrapper for injected hooks so the same hook
        // can be properly deduped by the scheduler. "__weh" stands for "with error
        // handling".
        const wrappedHook = hook.__weh ||
            (hook.__weh = (...args) => {
                if (target.isUnmounted) {
                    return;
                }
                // disable tracking inside all lifecycle hooks
                // since they can potentially be called inside effects.
                pauseTracking();
                // Set currentInstance during hook invocation.
                // This assumes the hook does not synchronously trigger other hooks, which
                // can only be false when the user does something really funky.
                setCurrentInstance(target);
                const res = callWithAsyncErrorHandling(hook, target, type, args);
                setCurrentInstance(null);
                resumeTracking();
                return res;
            });
        if (prepend) {
            hooks.unshift(wrappedHook);
        }
        else {
            hooks.push(wrappedHook);
        }
    }
    else if (__DEV__) {
        const apiName = `on${capitalize(ErrorTypeStrings[type].replace(/ hook$/, ''))}`;
        warn(`${apiName} is called when there is no active component instance to be ` +
            `associated with. ` +
            `Lifecycle injection APIs can only be used during execution of setup().` +
            (__FEATURE_SUSPENSE__
                ? ` If you are using async setup(), make sure to register lifecycle ` +
                    `hooks before the first await statement.`
                : ``));
    }
}
export const createHook = (lifecycle) => (hook, target = currentInstance) => injectHook(lifecycle, hook, target);
export const onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);
export const onMounted = createHook("m" /* MOUNTED */);
export const onBeforeUpdate = createHook("bu" /* BEFORE_UPDATE */);
export const onUpdated = createHook("u" /* UPDATED */);
export const onBeforeUnmount = createHook("bum" /* BEFORE_UNMOUNT */);
export const onUnmounted = createHook("um" /* UNMOUNTED */);
export const onRenderTriggered = createHook("rtg" /* RENDER_TRIGGERED */);
export const onRenderTracked = createHook("rtc" /* RENDER_TRACKED */);
export const onErrorCaptured = createHook("ec" /* ERROR_CAPTURED */);
