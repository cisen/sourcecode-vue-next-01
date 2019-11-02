import { nextTick } from './scheduler';
import { instanceWatch } from './apiWatch';
import { EMPTY_OBJ, hasOwn, isGloballyWhitelisted } from '@vue/shared';
import { warn } from './warning';
import { currentRenderingInstance, markAttrsAccessed } from './componentRenderUtils';
const publicPropertiesMap = {
    $data: 'data',
    $props: 'propsProxy',
    $attrs: 'attrs',
    $slots: 'slots',
    $refs: 'refs',
    $parent: 'parent',
    $root: 'root',
    $emit: 'emit',
    $options: 'type'
};
export const PublicInstanceProxyHandlers = {
    get(target, key) {
        const { renderContext, data, props, propsProxy, accessCache, type, sink } = target;
        // fast path for unscopables when using `with` block
        if (__RUNTIME_COMPILE__ && key === Symbol.unscopables) {
            return;
        }
        // This getter gets called for every property access on the render context
        // during render and is a major hotspot. The most expensive part of this
        // is the multiple hasOwn() calls. It's much faster to do a simple property
        // access on a plain object, so we use an accessCache object (with null
        // prototype) to memoize what access type a key corresponds to.
        const n = accessCache[key];
        if (n !== undefined) {
            switch (n) {
                case 0 /* DATA */:
                    return data[key];
                case 1 /* CONTEXT */:
                    return renderContext[key];
                case 2 /* PROPS */:
                    return propsProxy[key];
            }
        }
        else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
            accessCache[key] = 0 /* DATA */;
            return data[key];
        }
        else if (hasOwn(renderContext, key)) {
            accessCache[key] = 1 /* CONTEXT */;
            return renderContext[key];
        }
        else if (hasOwn(props, key)) {
            // only cache props access if component has declared (thus stable) props
            if (type.props != null) {
                accessCache[key] = 2 /* PROPS */;
            }
            // return the value from propsProxy for ref unwrapping and readonly
            return propsProxy[key];
        }
        else if (key === '$cache') {
            return target.renderCache || (target.renderCache = []);
        }
        else if (key === '$el') {
            return target.vnode.el;
        }
        else if (hasOwn(publicPropertiesMap, key)) {
            if (__DEV__ && key === '$attrs') {
                markAttrsAccessed();
            }
            return target[publicPropertiesMap[key]];
        }
        // methods are only exposed when options are supported
        if (__FEATURE_OPTIONS__) {
            switch (key) {
                case '$forceUpdate':
                    return target.update;
                case '$nextTick':
                    return nextTick;
                case '$watch':
                    return instanceWatch.bind(target);
            }
        }
        if (hasOwn(sink, key)) {
            return sink[key];
        }
        else if (__DEV__ && currentRenderingInstance != null) {
            warn(`Property ${JSON.stringify(key)} was accessed during render ` +
                `but is not defined on instance.`);
        }
    },
    set(target, key, value) {
        const { data, renderContext } = target;
        if (data !== EMPTY_OBJ && hasOwn(data, key)) {
            data[key] = value;
        }
        else if (hasOwn(renderContext, key)) {
            renderContext[key] = value;
        }
        else if (key[0] === '$' && key.slice(1) in target) {
            __DEV__ &&
                warn(`Attempting to mutate public property "${key}". ` +
                    `Properties starting with $ are reserved and readonly.`, target);
            return false;
        }
        else if (key in target.props) {
            __DEV__ &&
                warn(`Attempting to mutate prop "${key}". Props are readonly.`, target);
            return false;
        }
        else {
            target.sink[key] = value;
        }
        return true;
    }
};
if (__RUNTIME_COMPILE__) {
    // this trap is only called in browser-compiled render functions that use
    // `with (this) {}`
    PublicInstanceProxyHandlers.has = (_, key) => {
        return key[0] !== '_' && !isGloballyWhitelisted(key);
    };
}
