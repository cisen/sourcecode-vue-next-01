import { currentRenderingInstance } from '../componentRenderUtils';
import { currentInstance } from '../component';
import { camelize, capitalize, isString, isObject, isFunction } from '@vue/shared';
import { warn } from '../warning';
export function resolveComponent(name) {
    return resolveAsset('components', name);
}
export function resolveDynamicComponent(component) {
    if (!component)
        return;
    if (isString(component)) {
        return resolveAsset('components', component);
    }
    else if (isFunction(component) || isObject(component)) {
        return component;
    }
}
export function resolveDirective(name) {
    return resolveAsset('directives', name);
}
function resolveAsset(type, name) {
    const instance = currentRenderingInstance || currentInstance;
    if (instance) {
        let camelized;
        const registry = instance[type];
        const res = registry[name] ||
            registry[(camelized = camelize(name))] ||
            registry[capitalize(camelized)];
        if (__DEV__ && !res) {
            warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`);
        }
        return res;
    }
    else if (__DEV__) {
        warn(`resolve${capitalize(type.slice(0, -1))} ` +
            `can only be used in render() or setup().`);
    }
}
