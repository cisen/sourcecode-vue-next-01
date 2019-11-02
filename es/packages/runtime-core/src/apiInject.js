import { currentInstance } from './component';
import { warn } from './warning';
export function provide(key, value) {
    if (!currentInstance) {
        if (__DEV__) {
            warn(`provide() can only be used inside setup().`);
        }
    }
    else {
        let provides = currentInstance.provides;
        // by default an instance inherits its parent's provides object
        // but when it needs to provide values of its own, it creates its
        // own provides object using parent provides object as prototype.
        // this way in `inject` we can simply look up injections from direct
        // parent and let the prototype chain do the work.
        const parentProvides = currentInstance.parent && currentInstance.parent.provides;
        if (parentProvides === provides) {
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        // TS doesn't allow symbol as index type
        provides[key] = value;
    }
}
export function inject(key, defaultValue) {
    if (currentInstance) {
        const provides = currentInstance.provides;
        if (key in provides) {
            // TS doesn't allow symbol as index type
            return provides[key];
        }
        else if (defaultValue !== undefined) {
            return defaultValue;
        }
        else if (__DEV__) {
            warn(`injection "${String(key)}" not found.`);
        }
    }
    else if (__DEV__) {
        warn(`inject() can only be used inside setup().`);
    }
}
