import { validateComponentName } from './component';
import { validateDirectiveName } from './directives';
import { isFunction, NO } from '@vue/shared';
import { warn } from './warning';
import { createVNode } from './vnode';
export function createAppContext() {
    return {
        config: {
            devtools: true,
            performance: false,
            isNativeTag: NO,
            isCustomElement: NO,
            errorHandler: undefined,
            warnHandler: undefined
        },
        mixins: [],
        components: {},
        directives: {},
        provides: {}
    };
}
export function createAppAPI(render) {
    return function createApp() {
        const context = createAppContext();
        let isMounted = false;
        const app = {
            get config() {
                return context.config;
            },
            set config(v) {
                if (__DEV__) {
                    warn(`app.config cannot be replaced. Modify individual options instead.`);
                }
            },
            use(plugin) {
                if (isFunction(plugin)) {
                    plugin(app);
                }
                else if (isFunction(plugin.install)) {
                    plugin.install(app);
                }
                else if (__DEV__) {
                    warn(`A plugin must either be a function or an object with an "install" ` +
                        `function.`);
                }
                return app;
            },
            mixin(mixin) {
                if (__DEV__ && !__FEATURE_OPTIONS__) {
                    warn('Mixins are only available in builds supporting Options API');
                }
                if (!context.mixins.includes(mixin)) {
                    context.mixins.push(mixin);
                }
                else if (__DEV__) {
                    warn('Mixin has already been applied to target app' +
                        (mixin.name ? `: ${mixin.name}` : ''));
                }
                return app;
            },
            component(name, component) {
                if (__DEV__) {
                    validateComponentName(name, context.config);
                }
                if (!component) {
                    return context.components[name];
                }
                else {
                    if (__DEV__ && context.components[name]) {
                        warn(`Component "${name}" has already been registered in target app.`);
                    }
                    context.components[name] = component;
                    return app;
                }
            },
            directive(name, directive) {
                if (__DEV__) {
                    validateDirectiveName(name);
                }
                if (!directive) {
                    return context.directives[name];
                }
                else {
                    if (__DEV__ && context.directives[name]) {
                        warn(`Directive "${name}" has already been registered in target app.`);
                    }
                    context.directives[name] = directive;
                    return app;
                }
            },
            mount(rootComponent, rootContainer, rootProps) {
                if (!isMounted) {
                    const vnode = createVNode(rootComponent, rootProps);
                    // store app context on the root VNode.
                    // this will be set on the root instance on initial mount.
                    vnode.appContext = context;
                    render(vnode, rootContainer);
                    isMounted = true;
                    return vnode.component.renderProxy;
                }
                else if (__DEV__) {
                    warn(`App has already been mounted. Create a new app instance instead.`);
                }
            },
            provide(key, value) {
                if (__DEV__ && key in context.provides) {
                    warn(`App already provides property with key "${key}". ` +
                        `It will be overwritten with the new value.`);
                }
                // TypeScript doesn't allow symbols as index type
                // https://github.com/Microsoft/TypeScript/issues/24587
                context.provides[key] = value;
                return app;
            }
        };
        return app;
    };
}
