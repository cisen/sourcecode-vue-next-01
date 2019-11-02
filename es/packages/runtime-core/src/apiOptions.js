import { isFunction, extend, isString, isObject, isArray, EMPTY_OBJ, NOOP } from '@vue/shared';
import { computed } from './apiReactivity';
import { watch } from './apiWatch';
import { provide, inject } from './apiInject';
import { onBeforeMount, onMounted, onBeforeUpdate, onUpdated, onErrorCaptured, onRenderTracked, onBeforeUnmount, onUnmounted, onActivated, onDeactivated, onRenderTriggered } from './apiLifecycle';
import { reactive } from '@vue/reactivity';
import { warn } from './warning';
function createDuplicateChecker() {
    const cache = Object.create(null);
    return (type, key) => {
        if (cache[key]) {
            warn(`${type} property "${key}" is already defined in ${cache[key]}.`);
        }
        else {
            cache[key] = type;
        }
    };
}
export function applyOptions(instance, options, asMixin = false) {
    const renderContext = instance.renderContext === EMPTY_OBJ
        ? (instance.renderContext = reactive({}))
        : instance.renderContext;
    const ctx = instance.renderProxy;
    const { 
    // composition
    mixins, extends: extendsOptions, 
    // state
    props: propsOptions, data: dataOptions, computed: computedOptions, methods, watch: watchOptions, provide: provideOptions, inject: injectOptions, 
    // assets
    components, directives, 
    // lifecycle
    beforeMount, mounted, beforeUpdate, updated, activated, deactivated, beforeUnmount, unmounted, renderTracked, renderTriggered, errorCaptured } = options;
    const globalMixins = instance.appContext.mixins;
    // call it only during dev
    const checkDuplicateProperties = __DEV__ ? createDuplicateChecker() : null;
    // applyOptions is called non-as-mixin once per instance
    if (!asMixin) {
        callSyncHook('beforeCreate', options, ctx, globalMixins);
        // global mixins are applied first
        applyMixins(instance, globalMixins);
    }
    // extending a base component...
    if (extendsOptions) {
        applyOptions(instance, extendsOptions, true);
    }
    // local mixins
    if (mixins) {
        applyMixins(instance, mixins);
    }
    if (__DEV__ && propsOptions) {
        for (const key in propsOptions) {
            checkDuplicateProperties("Props" /* PROPS */, key);
        }
    }
    // state options
    if (dataOptions) {
        const data = isFunction(dataOptions) ? dataOptions.call(ctx) : dataOptions;
        if (!isObject(data)) {
            __DEV__ && warn(`data() should return an object.`);
        }
        else if (instance.data === EMPTY_OBJ) {
            if (__DEV__) {
                for (const key in data) {
                    checkDuplicateProperties("Data" /* DATA */, key);
                }
            }
            instance.data = reactive(data);
        }
        else {
            // existing data: this is a mixin or extends.
            extend(instance.data, data);
        }
    }
    if (computedOptions) {
        for (const key in computedOptions) {
            const opt = computedOptions[key];
            __DEV__ && checkDuplicateProperties("Computed" /* COMPUTED */, key);
            if (isFunction(opt)) {
                renderContext[key] = computed(opt.bind(ctx));
            }
            else {
                const { get, set } = opt;
                if (isFunction(get)) {
                    renderContext[key] = computed({
                        get: get.bind(ctx),
                        set: isFunction(set)
                            ? set.bind(ctx)
                            : __DEV__
                                ? () => {
                                    warn(`Computed property "${key}" was assigned to but it has no setter.`);
                                }
                                : NOOP
                    });
                }
                else if (__DEV__) {
                    warn(`Computed property "${key}" has no getter.`);
                }
            }
        }
    }
    if (methods) {
        for (const key in methods) {
            const methodHandler = methods[key];
            if (isFunction(methodHandler)) {
                __DEV__ && checkDuplicateProperties("Methods" /* METHODS */, key);
                renderContext[key] = methodHandler.bind(ctx);
            }
            else if (__DEV__) {
                warn(`Method "${key}" has type "${typeof methodHandler}" in the component definition. ` +
                    `Did you reference the function correctly?`);
            }
        }
    }
    if (watchOptions) {
        for (const key in watchOptions) {
            createWatcher(watchOptions[key], renderContext, ctx, key);
        }
    }
    if (provideOptions) {
        const provides = isFunction(provideOptions)
            ? provideOptions.call(ctx)
            : provideOptions;
        for (const key in provides) {
            provide(key, provides[key]);
        }
    }
    if (injectOptions) {
        if (isArray(injectOptions)) {
            for (let i = 0; i < injectOptions.length; i++) {
                const key = injectOptions[i];
                __DEV__ && checkDuplicateProperties("Inject" /* INJECT */, key);
                renderContext[key] = inject(key);
            }
        }
        else {
            for (const key in injectOptions) {
                __DEV__ && checkDuplicateProperties("Inject" /* INJECT */, key);
                const opt = injectOptions[key];
                if (isObject(opt)) {
                    renderContext[key] = inject(opt.from, opt.default);
                }
                else {
                    renderContext[key] = inject(opt);
                }
            }
        }
    }
    // asset options
    if (components) {
        extend(instance.components, components);
    }
    if (directives) {
        extend(instance.directives, directives);
    }
    // lifecycle options
    if (!asMixin) {
        callSyncHook('created', options, ctx, globalMixins);
    }
    if (beforeMount) {
        onBeforeMount(beforeMount.bind(ctx));
    }
    if (mounted) {
        onMounted(mounted.bind(ctx));
    }
    if (beforeUpdate) {
        onBeforeUpdate(beforeUpdate.bind(ctx));
    }
    if (updated) {
        onUpdated(updated.bind(ctx));
    }
    if (activated) {
        onActivated(activated.bind(ctx));
    }
    if (deactivated) {
        onDeactivated(deactivated.bind(ctx));
    }
    if (errorCaptured) {
        onErrorCaptured(errorCaptured.bind(ctx));
    }
    if (renderTracked) {
        onRenderTracked(renderTracked.bind(ctx));
    }
    if (renderTriggered) {
        onRenderTriggered(renderTriggered.bind(ctx));
    }
    if (beforeUnmount) {
        onBeforeUnmount(beforeUnmount.bind(ctx));
    }
    if (unmounted) {
        onUnmounted(unmounted.bind(ctx));
    }
}
function callSyncHook(name, options, ctx, globalMixins) {
    callHookFromMixins(name, globalMixins, ctx);
    const baseHook = options.extends && options.extends[name];
    if (baseHook) {
        baseHook.call(ctx);
    }
    const mixins = options.mixins;
    if (mixins) {
        callHookFromMixins(name, mixins, ctx);
    }
    const selfHook = options[name];
    if (selfHook) {
        selfHook.call(ctx);
    }
}
function callHookFromMixins(name, mixins, ctx) {
    for (let i = 0; i < mixins.length; i++) {
        const fn = mixins[i][name];
        if (fn) {
            fn.call(ctx);
        }
    }
}
function applyMixins(instance, mixins) {
    for (let i = 0; i < mixins.length; i++) {
        applyOptions(instance, mixins[i], true);
    }
}
function createWatcher(raw, renderContext, ctx, key) {
    const getter = () => ctx[key];
    if (isString(raw)) {
        const handler = renderContext[raw];
        if (isFunction(handler)) {
            watch(getter, handler);
        }
        else if (__DEV__) {
            warn(`Invalid watch handler specified by key "${raw}"`, handler);
        }
    }
    else if (isFunction(raw)) {
        watch(getter, raw.bind(ctx));
    }
    else if (isObject(raw)) {
        if (isArray(raw)) {
            raw.forEach(r => createWatcher(r, renderContext, ctx, key));
        }
        else {
            watch(getter, raw.handler.bind(ctx), raw);
        }
    }
    else if (__DEV__) {
        warn(`Invalid watch option: "${key}"`);
    }
}
