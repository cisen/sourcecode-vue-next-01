import { Text, Fragment, Comment, Portal, normalizeVNode, createVNode } from './vnode';
import { createComponentInstance, setupStatefulComponent } from './component';
import { renderComponentRoot, shouldUpdateComponent, updateHOCHostEl } from './componentRenderUtils';
import { isString, EMPTY_OBJ, EMPTY_ARR, isReservedProp, isFunction } from '@vue/shared';
import { queueJob, queuePostFlushCb, flushPostFlushCbs } from './scheduler';
import { effect, stop, isRef, toRaw } from '@vue/reactivity';
import { resolveProps } from './componentProps';
import { resolveSlots } from './componentSlots';
import { pushWarningContext, popWarningContext, warn } from './warning';
import { invokeDirectiveHook } from './directives';
import { createAppAPI } from './apiApp';
import { queueEffectWithSuspense } from './suspense';
import { callWithErrorHandling } from './errorHandling';
const prodEffectOptions = {
    scheduler: queueJob
};
function createDevEffectOptions(instance) {
    return {
        scheduler: queueJob,
        onTrack: instance.rtc ? e => invokeHooks(instance.rtc, e) : void 0,
        onTrigger: instance.rtg ? e => invokeHooks(instance.rtg, e) : void 0
    };
}
function isSameType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
}
export function invokeHooks(hooks, arg) {
    for (let i = 0; i < hooks.length; i++) {
        hooks[i](arg);
    }
}
export const queuePostRenderEffect = __FEATURE_SUSPENSE__
    ? queueEffectWithSuspense
    : queuePostFlushCb;
/**
 * The createRenderer function accepts two generic arguments:
 * HostNode and HostElement, corresponding to Node and Element types in the
 * host environment. For example, for runtime-dom, HostNode would be the DOM
 * `Node` interface and HostElement would be the DOM `Element` interface.
 *
 * Custom renderers can pass in the platform specific types like this:
 *
 * ``` js
 * const { render, createApp } = createRenderer<Node, Element>({
 *   patchProp,
 *   ...nodeOps
 * })
 * ```
 */
export function createRenderer(options) {
    const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, parentNode: hostParentNode, nextSibling: hostNextSibling, querySelector: hostQuerySelector } = options;
    const internals = {
        patch,
        unmount,
        move,
        next: getNextHostNode,
        options
    };
    function patch(n1, // null means this is a mount
    n2, container, anchor = null, parentComponent = null, parentSuspense = null, isSVG = false, optimized = false) {
        // patching & not same type, unmount old tree
        if (n1 != null && !isSameType(n1, n2)) {
            anchor = getNextHostNode(n1);
            unmount(n1, parentComponent, parentSuspense, true);
            n1 = null;
        }
        const { type, shapeFlag } = n2;
        switch (type) {
            case Text:
                processText(n1, n2, container, anchor);
                break;
            case Comment:
                processCommentNode(n1, n2, container, anchor);
                break;
            case Fragment:
                processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                break;
            case Portal:
                processPortal(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    processElement(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
                else if (shapeFlag & 6 /* COMPONENT */) {
                    processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
                else if (__FEATURE_SUSPENSE__ && shapeFlag & 64 /* SUSPENSE */) {
                    ;
                    type.process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, internals);
                }
                else if (__DEV__) {
                    warn('Invalid HostVNode type:', n2.type, `(${typeof n2.type})`);
                }
        }
    }
    function processText(n1, n2, container, anchor) {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateText(n2.children)), container, anchor);
        }
        else {
            const el = (n2.el = n1.el);
            if (n2.children !== n1.children) {
                hostSetText(el, n2.children);
            }
        }
    }
    function processCommentNode(n1, n2, container, anchor) {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateComment(n2.children || '')), container, anchor);
        }
        else {
            // there's no support for dynamic comments
            n2.el = n1.el;
        }
    }
    function processElement(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        if (n1 == null) {
            mountElement(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
        }
        else {
            patchElement(n1, n2, parentComponent, parentSuspense, isSVG, optimized);
        }
        if (n2.ref !== null && parentComponent !== null) {
            setRef(n2.ref, n1 && n1.ref, parentComponent, n2.el);
        }
    }
    function mountElement(vnode, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        const tag = vnode.type;
        isSVG = isSVG || tag === 'svg';
        const el = (vnode.el = hostCreateElement(tag, isSVG));
        const { props, shapeFlag } = vnode;
        if (props != null) {
            for (const key in props) {
                if (isReservedProp(key))
                    continue;
                hostPatchProp(el, key, props[key], null, isSVG);
            }
            if (props.onVnodeBeforeMount != null) {
                invokeDirectiveHook(props.onVnodeBeforeMount, parentComponent, vnode);
            }
        }
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            hostSetElementText(el, vnode.children);
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            mountChildren(vnode.children, el, null, parentComponent, parentSuspense, isSVG, optimized || vnode.dynamicChildren !== null);
        }
        hostInsert(el, container, anchor);
        if (props != null && props.onVnodeMounted != null) {
            queuePostRenderEffect(() => {
                invokeDirectiveHook(props.onVnodeMounted, parentComponent, vnode);
            }, parentSuspense);
        }
    }
    function mountChildren(children, container, anchor, parentComponent, parentSuspense, isSVG, optimized, start = 0) {
        for (let i = start; i < children.length; i++) {
            const child = optimized
                ? children[i]
                : (children[i] = normalizeVNode(children[i]));
            patch(null, child, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
        }
    }
    function patchElement(n1, n2, parentComponent, parentSuspense, isSVG, optimized) {
        const el = (n2.el = n1.el);
        const { patchFlag, dynamicChildren } = n2;
        const oldProps = (n1 && n1.props) || EMPTY_OBJ;
        const newProps = n2.props || EMPTY_OBJ;
        if (newProps.onVnodeBeforeUpdate != null) {
            invokeDirectiveHook(newProps.onVnodeBeforeUpdate, parentComponent, n2, n1);
        }
        if (patchFlag > 0) {
            // the presence of a patchFlag means this element's render code was
            // generated by the compiler and can take the fast path.
            // in this path old node and new node are guaranteed to have the same shape
            // (i.e. at the exact same position in the source template)
            if (patchFlag & 16 /* FULL_PROPS */) {
                // element props contain dynamic keys, full diff needed
                patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
            }
            else {
                // class
                // this flag is matched when the element has dynamic class bindings.
                if (patchFlag & 2 /* CLASS */) {
                    if (oldProps.class !== newProps.class) {
                        hostPatchProp(el, 'class', newProps.class, null, isSVG);
                    }
                }
                // style
                // this flag is matched when the element has dynamic style bindings
                if (patchFlag & 4 /* STYLE */) {
                    hostPatchProp(el, 'style', newProps.style, oldProps.style, isSVG);
                }
                // props
                // This flag is matched when the element has dynamic prop/attr bindings
                // other than class and style. The keys of dynamic prop/attrs are saved for
                // faster iteration.
                // Note dynamic keys like :[foo]="bar" will cause this optimization to
                // bail out and go through a full diff because we need to unset the old key
                if (patchFlag & 8 /* PROPS */) {
                    // if the flag is present then dynamicProps must be non-null
                    const propsToUpdate = n2.dynamicProps;
                    for (let i = 0; i < propsToUpdate.length; i++) {
                        const key = propsToUpdate[i];
                        const prev = oldProps[key];
                        const next = newProps[key];
                        if (prev !== next) {
                            hostPatchProp(el, key, next, prev, isSVG, n1.children, parentComponent, parentSuspense, unmountChildren);
                        }
                    }
                }
            }
            // text
            // This flag is matched when the element has only dynamic text children.
            // this flag is terminal (i.e. skips children diffing).
            if (patchFlag & 1 /* TEXT */) {
                if (n1.children !== n2.children) {
                    hostSetElementText(el, n2.children);
                }
                return; // terminal
            }
        }
        else if (!optimized && dynamicChildren == null) {
            // unoptimized, full diff
            patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
        }
        if (dynamicChildren != null) {
            patchBlockChildren(n1.dynamicChildren, dynamicChildren, el, parentComponent, parentSuspense, isSVG);
        }
        else if (!optimized) {
            // full diff
            patchChildren(n1, n2, el, null, parentComponent, parentSuspense, isSVG);
        }
        if (newProps.onVnodeUpdated != null) {
            queuePostRenderEffect(() => {
                invokeDirectiveHook(newProps.onVnodeUpdated, parentComponent, n2, n1);
            }, parentSuspense);
        }
    }
    // The fast path for blocks.
    function patchBlockChildren(oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, isSVG) {
        for (let i = 0; i < newChildren.length; i++) {
            const oldVNode = oldChildren[i];
            patch(oldVNode, newChildren[i], 
            // in the case of a Fragment, we need to provide the actual parent
            // of the Fragment itself so it can move its children. In other cases,
            // the parent container is not actually used so we just pass the
            // block element here to avoid a DOM parentNode call.
            oldVNode.type === Fragment
                ? hostParentNode(oldVNode.el)
                : fallbackContainer, null, parentComponent, parentSuspense, isSVG, true);
        }
    }
    function patchProps(el, vnode, oldProps, newProps, parentComponent, parentSuspense, isSVG) {
        if (oldProps !== newProps) {
            for (const key in newProps) {
                if (isReservedProp(key))
                    continue;
                const next = newProps[key];
                const prev = oldProps[key];
                if (next !== prev) {
                    hostPatchProp(el, key, next, prev, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                }
            }
            if (oldProps !== EMPTY_OBJ) {
                for (const key in oldProps) {
                    if (isReservedProp(key))
                        continue;
                    if (!(key in newProps)) {
                        hostPatchProp(el, key, null, null, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                    }
                }
            }
        }
    }
    function processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateComment(''));
        const fragmentEndAnchor = (n2.anchor = n1
            ? n1.anchor
            : hostCreateComment(''));
        if (n1 == null) {
            hostInsert(fragmentStartAnchor, container, anchor);
            hostInsert(fragmentEndAnchor, container, anchor);
            // a fragment can only have array children
            // since they are either generated by the compiler, or implicitly created
            // from arrays.
            mountChildren(n2.children, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, optimized);
        }
        else {
            patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, optimized);
        }
    }
    function processPortal(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        const targetSelector = n2.props && n2.props.target;
        const { patchFlag, shapeFlag, children } = n2;
        if (n1 == null) {
            const target = (n2.target = isString(targetSelector)
                ? hostQuerySelector(targetSelector)
                : targetSelector);
            if (target != null) {
                if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(target, children);
                }
                else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(children, target, null, parentComponent, parentSuspense, isSVG, optimized);
                }
            }
            else if (__DEV__) {
                warn('Invalid Portal target on mount:', target, `(${typeof target})`);
            }
        }
        else {
            // update content
            const target = (n2.target = n1.target);
            if (patchFlag === 1 /* TEXT */) {
                hostSetElementText(target, children);
            }
            else if (n2.dynamicChildren) {
                // fast path when the portal happens to be a block root
                patchBlockChildren(n1.dynamicChildren, n2.dynamicChildren, container, parentComponent, parentSuspense, isSVG);
            }
            else if (!optimized) {
                patchChildren(n1, n2, target, null, parentComponent, parentSuspense, isSVG);
            }
            // target changed
            if (targetSelector !== (n1.props && n1.props.target)) {
                const nextTarget = (n2.target = isString(targetSelector)
                    ? hostQuerySelector(targetSelector)
                    : null);
                if (nextTarget != null) {
                    // move content
                    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                        hostSetElementText(target, '');
                        hostSetElementText(nextTarget, children);
                    }
                    else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                        for (let i = 0; i < children.length; i++) {
                            move(children[i], nextTarget, null);
                        }
                    }
                }
                else if (__DEV__) {
                    warn('Invalid Portal target on update:', target, `(${typeof target})`);
                }
            }
        }
        // insert an empty node as the placeholder for the portal
        processCommentNode(n1, n2, container, anchor);
    }
    function processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        if (n1 == null) {
            if (n2.shapeFlag & 256 /* STATEFUL_COMPONENT_KEPT_ALIVE */) {
                ;
                parentComponent.sink.activate(n2, container, anchor);
            }
            else {
                mountComponent(n2, container, anchor, parentComponent, parentSuspense, isSVG);
            }
        }
        else {
            const instance = (n2.component = n1.component);
            if (shouldUpdateComponent(n1, n2, optimized)) {
                if (__FEATURE_SUSPENSE__ &&
                    instance.asyncDep &&
                    !instance.asyncResolved) {
                    // async & still pending - just update props and slots
                    // since the component's reactive effect for render isn't set-up yet
                    if (__DEV__) {
                        pushWarningContext(n2);
                    }
                    updateComponentPreRender(instance, n2);
                    if (__DEV__) {
                        popWarningContext();
                    }
                    return;
                }
                else {
                    // normal update
                    instance.next = n2;
                    // instance.update is the reactive effect runner.
                    instance.update();
                }
            }
            else {
                // no update needed. just copy over properties
                n2.component = n1.component;
                n2.el = n1.el;
            }
        }
        if (n2.ref !== null && parentComponent !== null) {
            setRef(n2.ref, n1 && n1.ref, parentComponent, n2.component.renderProxy);
        }
    }
    function mountComponent(initialVNode, container, anchor, parentComponent, parentSuspense, isSVG) {
        const instance = (initialVNode.component = createComponentInstance(initialVNode, parentComponent));
        if (__DEV__) {
            pushWarningContext(initialVNode);
        }
        const Comp = initialVNode.type;
        // inject renderer internals for keepAlive
        if (Comp.__isKeepAlive) {
            const sink = instance.sink;
            sink.renderer = internals;
            sink.parentSuspense = parentSuspense;
        }
        // resolve props and slots for setup context
        const propsOptions = Comp.props;
        resolveProps(instance, initialVNode.props, propsOptions);
        resolveSlots(instance, initialVNode.children);
        // setup stateful logic
        if (initialVNode.shapeFlag & 4 /* STATEFUL_COMPONENT */) {
            setupStatefulComponent(instance, parentSuspense);
        }
        // setup() is async. This component relies on async logic to be resolved
        // before proceeding
        if (__FEATURE_SUSPENSE__ && instance.asyncDep) {
            if (!parentSuspense) {
                if (__DEV__)
                    warn('async setup() is used without a suspense boundary!');
                return;
            }
            parentSuspense.registerDep(instance, setupRenderEffect);
            // give it a placeholder
            const placeholder = (instance.subTree = createVNode(Comment));
            processCommentNode(null, placeholder, container, anchor);
            initialVNode.el = placeholder.el;
            return;
        }
        setupRenderEffect(instance, parentComponent, parentSuspense, initialVNode, container, anchor, isSVG);
        if (__DEV__) {
            popWarningContext();
        }
    }
    function setupRenderEffect(instance, parentComponent, parentSuspense, initialVNode, container, anchor, isSVG) {
        // create reactive effect for rendering
        let mounted = false;
        instance.update = effect(function componentEffect() {
            if (!mounted) {
                const subTree = (instance.subTree = renderComponentRoot(instance));
                // beforeMount hook
                if (instance.bm !== null) {
                    invokeHooks(instance.bm);
                }
                patch(null, subTree, container, anchor, instance, parentSuspense, isSVG);
                initialVNode.el = subTree.el;
                // mounted hook
                if (instance.m !== null) {
                    queuePostRenderEffect(instance.m, parentSuspense);
                }
                // activated hook for keep-alive roots.
                if (instance.a !== null &&
                    instance.vnode.shapeFlag &
                        128 /* STATEFUL_COMPONENT_SHOULD_KEEP_ALIVE */) {
                    queuePostRenderEffect(instance.a, parentSuspense);
                }
                mounted = true;
            }
            else {
                // updateComponent
                // This is triggered by mutation of component's own state (next: null)
                // OR parent calling processComponent (next: HostVNode)
                const { next } = instance;
                if (__DEV__) {
                    pushWarningContext(next || instance.vnode);
                }
                if (next !== null) {
                    updateComponentPreRender(instance, next);
                }
                const prevTree = instance.subTree;
                const nextTree = (instance.subTree = renderComponentRoot(instance));
                // beforeUpdate hook
                if (instance.bu !== null) {
                    invokeHooks(instance.bu);
                }
                // reset refs
                // only needed if previous patch had refs
                if (instance.refs !== EMPTY_OBJ) {
                    instance.refs = {};
                }
                patch(prevTree, nextTree, 
                // parent may have changed if it's in a portal
                hostParentNode(prevTree.el), 
                // anchor may have changed if it's in a fragment
                getNextHostNode(prevTree), instance, parentSuspense, isSVG);
                instance.vnode.el = nextTree.el;
                if (next === null) {
                    // self-triggered update. In case of HOC, update parent component
                    // vnode el. HOC is indicated by parent instance's subTree pointing
                    // to child component's vnode
                    updateHOCHostEl(instance, nextTree.el);
                }
                // updated hook
                if (instance.u !== null) {
                    queuePostRenderEffect(instance.u, parentSuspense);
                }
                if (__DEV__) {
                    popWarningContext();
                }
            }
        }, __DEV__ ? createDevEffectOptions(instance) : prodEffectOptions);
    }
    function updateComponentPreRender(instance, nextVNode) {
        nextVNode.component = instance;
        instance.vnode = nextVNode;
        instance.next = null;
        resolveProps(instance, nextVNode.props, nextVNode.type.props);
        resolveSlots(instance, nextVNode.children);
    }
    function patchChildren(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized = false) {
        const c1 = n1 && n1.children;
        const prevShapeFlag = n1 ? n1.shapeFlag : 0;
        const c2 = n2.children;
        const { patchFlag, shapeFlag } = n2;
        if (patchFlag === -1 /* BAIL */) {
            optimized = false;
        }
        // fast path
        if (patchFlag > 0) {
            if (patchFlag & 64 /* KEYED_FRAGMENT */) {
                // this could be either fully-keyed or mixed (some keyed some not)
                // presence of patchFlag means children are guaranteed to be arrays
                patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                return;
            }
            else if (patchFlag & 128 /* UNKEYED_FRAGMENT */) {
                // unkeyed
                patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                return;
            }
        }
        // children has 3 possibilities: text, array or no children.
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            // text children fast path
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                unmountChildren(c1, parentComponent, parentSuspense);
            }
            if (c2 !== c1) {
                hostSetElementText(container, c2);
            }
        }
        else {
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                // prev children was array
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    // two arrays, cannot assume anything, do full diff
                    patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
                else {
                    // no new children, just unmount old
                    unmountChildren(c1, parentComponent, parentSuspense, true);
                }
            }
            else {
                // prev children was text OR null
                // new children is array OR null
                if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(container, '');
                }
                // mount new if array
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
            }
        }
    }
    function patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) {
        c1 = c1 || EMPTY_ARR;
        c2 = c2 || EMPTY_ARR;
        const oldLength = c1.length;
        const newLength = c2.length;
        const commonLength = Math.min(oldLength, newLength);
        let i;
        for (i = 0; i < commonLength; i++) {
            const nextChild = optimized
                ? c2[i]
                : (c2[i] = normalizeVNode(c2[i]));
            patch(c1[i], nextChild, container, null, parentComponent, parentSuspense, isSVG, optimized);
        }
        if (oldLength > newLength) {
            // remove old
            unmountChildren(c1, parentComponent, parentSuspense, true, commonLength);
        }
        else {
            // mount new
            mountChildren(c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, commonLength);
        }
    }
    // can be all-keyed or mixed
    function patchKeyedChildren(c1, c2, container, parentAnchor, parentComponent, parentSuspense, isSVG, optimized) {
        let i = 0;
        const l2 = c2.length;
        let e1 = c1.length - 1; // prev ending index
        let e2 = l2 - 1; // next ending index
        // 1. sync from start
        // (a b) c
        // (a b) d e
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = optimized
                ? c2[i]
                : (c2[i] = normalizeVNode(c2[i]));
            if (isSameType(n1, n2)) {
                patch(n1, n2, container, parentAnchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else {
                break;
            }
            i++;
        }
        // 2. sync from end
        // a (b c)
        // d e (b c)
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = optimized
                ? c2[i]
                : (c2[e2] = normalizeVNode(c2[e2]));
            if (isSameType(n1, n2)) {
                patch(n1, n2, container, parentAnchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 3. common sequence + mount
        // (a b)
        // (a b) c
        // i = 2, e1 = 1, e2 = 2
        // (a b)
        // c (a b)
        // i = 0, e1 = -1, e2 = 0
        if (i > e1) {
            if (i <= e2) {
                const nextPos = e2 + 1;
                const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
                while (i <= e2) {
                    patch(null, optimized ? c2[i] : (c2[i] = normalizeVNode(c2[i])), container, anchor, parentComponent, parentSuspense, isSVG);
                    i++;
                }
            }
        }
        // 4. common sequence + unmount
        // (a b) c
        // (a b)
        // i = 2, e1 = 2, e2 = 1
        // a (b c)
        // (b c)
        // i = 0, e1 = 0, e2 = -1
        else if (i > e2) {
            while (i <= e1) {
                unmount(c1[i], parentComponent, parentSuspense, true);
                i++;
            }
        }
        // 5. unknown sequence
        // [i ... e1 + 1]: a b [c d e] f g
        // [i ... e2 + 1]: a b [e d c h] f g
        // i = 2, e1 = 4, e2 = 5
        else {
            const s1 = i; // prev starting index
            const s2 = i; // next starting index
            // 5.1 build key:index map for newChildren
            const keyToNewIndexMap = new Map();
            for (i = s2; i <= e2; i++) {
                const nextChild = optimized
                    ? c2[i]
                    : (c2[i] = normalizeVNode(c2[i]));
                if (nextChild.key != null) {
                    if (__DEV__ && keyToNewIndexMap.has(nextChild.key)) {
                        warn(`Duplicate keys found during update:`, JSON.stringify(nextChild.key), `Make sure keys are unique.`);
                    }
                    keyToNewIndexMap.set(nextChild.key, i);
                }
            }
            // 5.2 loop through old children left to be patched and try to patch
            // matching nodes & remove nodes that are no longer present
            let j;
            let patched = 0;
            const toBePatched = e2 - s2 + 1;
            let moved = false;
            // used to track whether any node has moved
            let maxNewIndexSoFar = 0;
            // works as Map<newIndex, oldIndex>
            // Note that oldIndex is offset by +1
            // and oldIndex = 0 is a special value indicating the new node has
            // no corresponding old node.
            // used for determining longest stable subsequence
            const newIndexToOldIndexMap = new Array(toBePatched);
            for (i = 0; i < toBePatched; i++)
                newIndexToOldIndexMap[i] = 0;
            for (i = s1; i <= e1; i++) {
                const prevChild = c1[i];
                if (patched >= toBePatched) {
                    // all new children have been patched so this can only be a removal
                    unmount(prevChild, parentComponent, parentSuspense, true);
                    continue;
                }
                let newIndex;
                if (prevChild.key != null) {
                    newIndex = keyToNewIndexMap.get(prevChild.key);
                }
                else {
                    // key-less node, try to locate a key-less node of the same type
                    for (j = s2; j <= e2; j++) {
                        if (newIndexToOldIndexMap[j - s2] === 0 &&
                            isSameType(prevChild, c2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                if (newIndex === undefined) {
                    unmount(prevChild, parentComponent, parentSuspense, true);
                }
                else {
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    if (newIndex >= maxNewIndexSoFar) {
                        maxNewIndexSoFar = newIndex;
                    }
                    else {
                        moved = true;
                    }
                    patch(prevChild, c2[newIndex], container, null, parentComponent, parentSuspense, isSVG, optimized);
                    patched++;
                }
            }
            // 5.3 move and mount
            // generate longest stable subsequence only when nodes have moved
            const increasingNewIndexSequence = moved
                ? getSequence(newIndexToOldIndexMap)
                : EMPTY_ARR;
            j = increasingNewIndexSequence.length - 1;
            // looping backwards so that we can use last patched node as anchor
            for (i = toBePatched - 1; i >= 0; i--) {
                const nextIndex = s2 + i;
                const nextChild = c2[nextIndex];
                const anchor = nextIndex + 1 < l2
                    ? c2[nextIndex + 1].el
                    : parentAnchor;
                if (newIndexToOldIndexMap[i] === 0) {
                    // mount new
                    patch(null, nextChild, container, anchor, parentComponent, parentSuspense, isSVG);
                }
                else if (moved) {
                    // move if:
                    // There is no stable subsequence (e.g. a reverse)
                    // OR current node is not among the stable sequence
                    if (j < 0 || i !== increasingNewIndexSequence[j]) {
                        move(nextChild, container, anchor);
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    }
    function move(vnode, container, anchor) {
        if (vnode.shapeFlag & 6 /* COMPONENT */) {
            move(vnode.component.subTree, container, anchor);
            return;
        }
        if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & 64 /* SUSPENSE */) {
            vnode.suspense.move(container, anchor);
            return;
        }
        if (vnode.type === Fragment) {
            hostInsert(vnode.el, container, anchor);
            const children = vnode.children;
            for (let i = 0; i < children.length; i++) {
                move(children[i], container, anchor);
            }
            hostInsert(vnode.anchor, container, anchor);
        }
        else {
            hostInsert(vnode.el, container, anchor);
        }
    }
    function unmount(vnode, parentComponent, parentSuspense, doRemove) {
        const { props, ref, type, children, dynamicChildren, shapeFlag, anchor } = vnode;
        // unset ref
        if (ref !== null && parentComponent !== null) {
            setRef(ref, null, parentComponent, null);
        }
        if (shapeFlag & 6 /* COMPONENT */) {
            if (shapeFlag & 128 /* STATEFUL_COMPONENT_SHOULD_KEEP_ALIVE */) {
                ;
                parentComponent.sink.deactivate(vnode);
            }
            else {
                unmountComponent(vnode.component, parentSuspense, doRemove);
            }
            return;
        }
        if (__FEATURE_SUSPENSE__ && shapeFlag & 64 /* SUSPENSE */) {
            vnode.suspense.unmount(parentSuspense, doRemove);
            return;
        }
        if (props != null && props.onVnodeBeforeUnmount != null) {
            invokeDirectiveHook(props.onVnodeBeforeUnmount, parentComponent, vnode);
        }
        const shouldRemoveChildren = type === Fragment && doRemove;
        if (dynamicChildren != null) {
            unmountChildren(dynamicChildren, parentComponent, parentSuspense, shouldRemoveChildren);
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            unmountChildren(children, parentComponent, parentSuspense, shouldRemoveChildren);
        }
        if (doRemove) {
            hostRemove(vnode.el);
            if (anchor != null)
                hostRemove(anchor);
        }
        if (props != null && props.onVnodeUnmounted != null) {
            queuePostRenderEffect(() => {
                invokeDirectiveHook(props.onVnodeUnmounted, parentComponent, vnode);
            }, parentSuspense);
        }
    }
    function unmountComponent(instance, parentSuspense, doRemove) {
        const { bum, effects, update, subTree, um, da, isDeactivated } = instance;
        // beforeUnmount hook
        if (bum !== null) {
            invokeHooks(bum);
        }
        if (effects !== null) {
            for (let i = 0; i < effects.length; i++) {
                stop(effects[i]);
            }
        }
        // update may be null if a component is unmounted before its async
        // setup has resolved.
        if (update !== null) {
            stop(update);
            unmount(subTree, instance, parentSuspense, doRemove);
        }
        // unmounted hook
        if (um !== null) {
            queuePostRenderEffect(um, parentSuspense);
        }
        // deactivated hook
        if (da !== null &&
            !isDeactivated &&
            instance.vnode.shapeFlag & 128 /* STATEFUL_COMPONENT_SHOULD_KEEP_ALIVE */) {
            queuePostRenderEffect(da, parentSuspense);
        }
        queuePostFlushCb(() => {
            instance.isUnmounted = true;
        });
        // A component with async dep inside a pending suspense is unmounted before
        // its async dep resolves. This should remove the dep from the suspense, and
        // cause the suspense to resolve immediately if that was the last dep.
        if (__FEATURE_SUSPENSE__ &&
            parentSuspense !== null &&
            !parentSuspense.isResolved &&
            !parentSuspense.isUnmounted &&
            instance.asyncDep !== null &&
            !instance.asyncResolved) {
            parentSuspense.deps--;
            if (parentSuspense.deps === 0) {
                parentSuspense.resolve();
            }
        }
    }
    function unmountChildren(children, parentComponent, parentSuspense, doRemove, start = 0) {
        for (let i = start; i < children.length; i++) {
            unmount(children[i], parentComponent, parentSuspense, doRemove);
        }
    }
    function getNextHostNode(vnode) {
        if (vnode.shapeFlag & 6 /* COMPONENT */) {
            return getNextHostNode(vnode.component.subTree);
        }
        if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & 64 /* SUSPENSE */) {
            return vnode.suspense.next();
        }
        return hostNextSibling((vnode.anchor || vnode.el));
    }
    function setRef(ref, oldRef, parent, value) {
        const refs = parent.refs === EMPTY_OBJ ? (parent.refs = {}) : parent.refs;
        const renderContext = toRaw(parent.renderContext);
        // unset old ref
        if (oldRef !== null && oldRef !== ref) {
            if (isString(oldRef)) {
                refs[oldRef] = null;
                const oldSetupRef = renderContext[oldRef];
                if (isRef(oldSetupRef)) {
                    oldSetupRef.value = null;
                }
            }
            else if (isRef(oldRef)) {
                oldRef.value = null;
            }
        }
        if (isString(ref)) {
            const setupRef = renderContext[ref];
            if (isRef(setupRef)) {
                setupRef.value = value;
            }
            refs[ref] = value;
        }
        else if (isRef(ref)) {
            ref.value = value;
        }
        else if (isFunction(ref)) {
            callWithErrorHandling(ref, parent, 10 /* FUNCTION_REF */, [value, refs]);
        }
        else if (__DEV__) {
            warn('Invalid template ref type:', value, `(${typeof value})`);
        }
    }
    const render = (vnode, container) => {
        if (vnode == null) {
            if (container._vnode) {
                unmount(container._vnode, null, null, true);
            }
        }
        else {
            patch(container._vnode || null, vnode, container);
        }
        flushPostFlushCbs();
        container._vnode = vnode;
    };
    return {
        render,
        createApp: createAppAPI(render)
    };
}
// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr) {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = ((u + v) / 2) | 0;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                }
                else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}
