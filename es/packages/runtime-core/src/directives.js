/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return withDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/
import { isFunction, EMPTY_OBJ, makeMap, EMPTY_ARR } from '@vue/shared';
import { warn } from './warning';
import { currentRenderingInstance } from './componentRenderUtils';
import { callWithAsyncErrorHandling } from './errorHandling';
const isBuiltInDirective = /*#__PURE__*/ makeMap('bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text');
export function validateDirectiveName(name) {
    if (isBuiltInDirective(name)) {
        warn('Do not use built-in directive ids as custom directive id: ' + name);
    }
}
const directiveToVnodeHooksMap = /*#__PURE__*/ [
    'beforeMount',
    'mounted',
    'beforeUpdate',
    'updated',
    'beforeUnmount',
    'unmounted'
].reduce((map, key) => {
    const vnodeKey = `onVnode` + key[0].toUpperCase() + key.slice(1);
    const vnodeHook = (vnode, prevVnode) => {
        const bindings = vnode.dirs;
        const prevBindings = prevVnode ? prevVnode.dirs : EMPTY_ARR;
        for (let i = 0; i < bindings.length; i++) {
            const binding = bindings[i];
            const hook = binding.dir[key];
            if (hook != null) {
                if (prevVnode != null) {
                    binding.oldValue = prevBindings[i].value;
                }
                hook(vnode.el, binding, vnode, prevVnode);
            }
        }
    };
    map[key] = [vnodeKey, vnodeHook];
    return map;
}, {});
export function withDirectives(vnode, directives) {
    const internalInstance = currentRenderingInstance;
    if (internalInstance === null) {
        __DEV__ && warn(`withDirectives can only be used inside render functions.`);
        return vnode;
    }
    const instance = internalInstance.renderProxy;
    const props = vnode.props || (vnode.props = {});
    const bindings = vnode.dirs || (vnode.dirs = new Array(directives.length));
    const injected = {};
    for (let i = 0; i < directives.length; i++) {
        let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
        if (isFunction(dir)) {
            dir = {
                mounted: dir,
                updated: dir
            };
        }
        bindings[i] = {
            dir,
            instance,
            value,
            oldValue: void 0,
            arg,
            modifiers
        };
        // inject onVnodeXXX hooks
        for (const key in dir) {
            if (!injected[key]) {
                const { 0: hookName, 1: hook } = directiveToVnodeHooksMap[key];
                const existing = props[hookName];
                props[hookName] = existing ? [].concat(existing, hook) : hook;
                injected[key] = true;
            }
        }
    }
    return vnode;
}
export function invokeDirectiveHook(hook, instance, vnode, prevVNode = null) {
    callWithAsyncErrorHandling(hook, instance, 7 /* DIRECTIVE_HOOK */, [
        vnode,
        prevVNode
    ]);
}
