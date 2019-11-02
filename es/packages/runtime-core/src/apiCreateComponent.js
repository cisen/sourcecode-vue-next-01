import { isFunction } from '@vue/shared';
// implementation, close to no-op
export function createComponent(options) {
    return isFunction(options) ? { setup: options } : options;
}
