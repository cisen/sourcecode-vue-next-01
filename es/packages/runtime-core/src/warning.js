import { isString, isFunction } from '@vue/shared';
import { toRaw } from '@vue/reactivity';
import { callWithErrorHandling } from './errorHandling';
const stack = [];
export function pushWarningContext(vnode) {
    stack.push(vnode);
}
export function popWarningContext() {
    stack.pop();
}
export function warn(msg, ...args) {
    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler;
    const trace = getComponentTrace();
    if (appWarnHandler) {
        callWithErrorHandling(appWarnHandler, instance, 9 /* APP_WARN_HANDLER */, [
            msg + args.join(''),
            instance && instance.renderProxy,
            formatTrace(trace).join('')
        ]);
        return;
    }
    console.warn(`[Vue warn]: ${msg}`, ...args);
    // avoid spamming console during tests
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        return;
    }
    if (!trace.length) {
        return;
    }
    if (trace.length > 1 && console.groupCollapsed) {
        console.groupCollapsed('at', ...formatTraceEntry(trace[0]));
        const logs = [];
        trace.slice(1).forEach((entry, i) => {
            if (i !== 0)
                logs.push('\n');
            logs.push(...formatTraceEntry(entry, i + 1));
        });
        console.log(...logs);
        console.groupEnd();
    }
    else {
        console.log(...formatTrace(trace));
    }
}
function getComponentTrace() {
    let currentVNode = stack[stack.length - 1];
    if (!currentVNode) {
        return [];
    }
    // we can't just use the stack because it will be incomplete during updates
    // that did not start from the root. Re-construct the parent chain using
    // instance parent pointers.
    const normalizedStack = [];
    while (currentVNode) {
        const last = normalizedStack[0];
        if (last && last.vnode === currentVNode) {
            last.recurseCount++;
        }
        else {
            normalizedStack.push({
                vnode: currentVNode,
                recurseCount: 0
            });
        }
        const parentInstance = currentVNode.component
            .parent;
        currentVNode = parentInstance && parentInstance.vnode;
    }
    return normalizedStack;
}
function formatTrace(trace) {
    const logs = [];
    trace.forEach((entry, i) => {
        const formatted = formatTraceEntry(entry, i);
        if (i === 0) {
            logs.push('at', ...formatted);
        }
        else {
            logs.push('\n', ...formatted);
        }
    });
    return logs;
}
function formatTraceEntry({ vnode, recurseCount }, depth = 0) {
    const padding = depth === 0 ? '' : ' '.repeat(depth * 2 + 1);
    const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
    const open = padding + `<${formatComponentName(vnode)}`;
    const close = `>` + postfix;
    const rootLabel = vnode.component.parent == null ? `(Root)` : ``;
    return vnode.props
        ? [open, ...formatProps(vnode.props), close, rootLabel]
        : [open + close, rootLabel];
}
const classifyRE = /(?:^|[-_])(\w)/g;
const classify = (str) => str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '');
function formatComponentName(vnode, file) {
    const Component = vnode.type;
    let name = isFunction(Component) ? Component.displayName : Component.name;
    if (!name && file) {
        const match = file.match(/([^/\\]+)\.vue$/);
        if (match) {
            name = match[1];
        }
    }
    return name ? classify(name) : 'AnonymousComponent';
}
function formatProps(props) {
    const res = [];
    for (const key in props) {
        const value = props[key];
        if (isString(value)) {
            res.push(`${key}=${JSON.stringify(value)}`);
        }
        else {
            res.push(`${key}=`, String(toRaw(value)));
        }
    }
    return res;
}
