import { getCurrentInstance, currentInstance } from './component';
import { cloneVNode, isVNode } from './vnode';
import { warn } from './warning';
import { onBeforeUnmount, injectHook, onUnmounted } from './apiLifecycle';
import { isString, isArray } from '@vue/shared';
import { watch } from './apiWatch';
import { queuePostRenderEffect, invokeHooks } from './createRenderer';
export const KeepAlive = {
    name: `KeepAlive`,
    // Marker for special handling inside the renderer. We are not using a ===
    // check directly on KeepAlive in the renderer, because importing it directly
    // would prevent it from being tree-shaken.
    __isKeepAlive: true,
    setup(props, { slots }) {
        const cache = new Map();
        const keys = new Set();
        let current = null;
        const instance = getCurrentInstance();
        // KeepAlive communicates with the instantiated renderer via the "sink"
        // where the renderer passes in platform-specific functions, and the
        // KeepAlivei instance expses activcate/decativate implementations.
        // The whole point of this is to avoid importing KeepAlive directly in the
        // renderer to facilitate tree-shaking.
        const sink = instance.sink;
        const { renderer: { move, unmount: _unmount, options: { createElement } }, parentSuspense } = sink;
        const storageContainer = createElement('div');
        sink.activate = (vnode, container, anchor) => {
            move(vnode, container, anchor);
            queuePostRenderEffect(() => {
                const component = vnode.component;
                component.isDeactivated = false;
                if (component.a !== null) {
                    invokeHooks(component.a);
                }
            }, parentSuspense);
        };
        sink.deactivate = (vnode) => {
            move(vnode, storageContainer, null);
            queuePostRenderEffect(() => {
                const component = vnode.component;
                if (component.da !== null) {
                    invokeHooks(component.da);
                }
                component.isDeactivated = true;
            }, parentSuspense);
        };
        function unmount(vnode) {
            // reset the shapeFlag so it can be properly unmounted
            vnode.shapeFlag = 4 /* STATEFUL_COMPONENT */;
            _unmount(vnode, instance, parentSuspense);
        }
        function pruneCache(filter) {
            cache.forEach((vnode, key) => {
                const name = getName(vnode.type);
                if (name && (!filter || !filter(name))) {
                    pruneCacheEntry(key);
                }
            });
        }
        function pruneCacheEntry(key) {
            const cached = cache.get(key);
            if (!current || cached.type !== current.type) {
                unmount(cached);
            }
            else if (current) {
                // current active instance should no longer be kept-alive.
                // we can't unmount it now but it might be later, so reset its flag now.
                current.shapeFlag = 4 /* STATEFUL_COMPONENT */;
            }
            cache.delete(key);
            keys.delete(key);
        }
        watch(() => [props.include, props.exclude], ([include, exclude]) => {
            include && pruneCache(name => matches(include, name));
            exclude && pruneCache(name => matches(exclude, name));
        }, { lazy: true });
        onBeforeUnmount(() => {
            cache.forEach(unmount);
        });
        return () => {
            if (!slots.default) {
                return null;
            }
            const children = slots.default();
            let vnode = children[0];
            if (children.length > 1) {
                if (__DEV__) {
                    warn(`KeepAlive should contain exactly one component child.`);
                }
                current = null;
                return children;
            }
            else if (!isVNode(vnode) ||
                !(vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */)) {
                current = null;
                return vnode;
            }
            const comp = vnode.type;
            const name = getName(comp);
            const { include, exclude, max } = props;
            if ((include && (!name || !matches(include, name))) ||
                (exclude && name && matches(exclude, name))) {
                return vnode;
            }
            const key = vnode.key == null ? comp : vnode.key;
            const cached = cache.get(key);
            // clone vnode if it's reused because we are going to mutate it
            if (vnode.el) {
                vnode = cloneVNode(vnode);
            }
            cache.set(key, vnode);
            if (cached) {
                // copy over mounted state
                vnode.el = cached.el;
                vnode.anchor = cached.anchor;
                vnode.component = cached.component;
                // avoid vnode being mounted as fresh
                vnode.shapeFlag |= 256 /* STATEFUL_COMPONENT_KEPT_ALIVE */;
                // make this key the freshest
                keys.delete(key);
                keys.add(key);
            }
            else {
                keys.add(key);
                // prune oldest entry
                if (max && keys.size > parseInt(max, 10)) {
                    pruneCacheEntry(Array.from(keys)[0]);
                }
            }
            // avoid vnode being unmounted
            vnode.shapeFlag |= 128 /* STATEFUL_COMPONENT_SHOULD_KEEP_ALIVE */;
            current = vnode;
            return vnode;
        };
    }
};
if (__DEV__) {
    ;
    KeepAlive.props = {
        include: [String, RegExp, Array],
        exclude: [String, RegExp, Array],
        max: [String, Number]
    };
}
function getName(comp) {
    return comp.displayName || comp.name;
}
function matches(pattern, name) {
    if (isArray(pattern)) {
        return pattern.some((p) => matches(p, name));
    }
    else if (isString(pattern)) {
        return pattern.split(',').indexOf(name) > -1;
    }
    else if (pattern.test) {
        return pattern.test(name);
    }
    /* istanbul ignore next */
    return false;
}
export function onActivated(hook, target) {
    registerKeepAliveHook(hook, "a" /* ACTIVATED */, target);
}
export function onDeactivated(hook, target) {
    registerKeepAliveHook(hook, "da" /* DEACTIVATED */, target);
}
function registerKeepAliveHook(hook, type, target = currentInstance) {
    // cache the deactivate branch check wrapper for injected hooks so the same
    // hook can be properly deduped by the scheduler. "__wdc" stands for "with
    // deactivation check".
    const wrappedHook = hook.__wdc ||
        (hook.__wdc = () => {
            // only fire the hook if the target instance is NOT in a deactivated branch.
            let current = target;
            while (current) {
                if (current.isDeactivated) {
                    return;
                }
                current = current.parent;
            }
            hook();
        });
    injectHook(type, wrappedHook, target);
    // In addition to registering it on the target instance, we walk up the parent
    // chain and register it on all ancestor instances that are keep-alive roots.
    // This avoids the need to walk the entire component tree when invoking these
    // hooks, and more importantly, avoids the need to track child components in
    // arrays.
    if (target) {
        let current = target.parent;
        while (current && current.parent) {
            if (current.parent.type === KeepAlive) {
                injectToKeepAliveRoot(wrappedHook, type, target, current);
            }
            current = current.parent;
        }
    }
}
function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
    injectHook(type, hook, keepAliveRoot, true /* prepend */);
    onUnmounted(() => {
        const hooks = keepAliveRoot[type];
        hooks.splice(hooks.indexOf(hook), 1);
    }, target);
}
