import { normalizeVNode } from './vnode';
import { isFunction, isArray } from '@vue/shared';
import { handleSetupResult } from './component';
import { queuePostFlushCb, queueJob } from './scheduler';
import { updateHOCHostEl } from './componentRenderUtils';
import { handleError } from './errorHandling';
import { pushWarningContext, popWarningContext } from './warning';
export function isSuspenseType(type) {
    return type.__isSuspense === true;
}
export const SuspenseImpl = {
    __isSuspense: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, 
    // platform-specific impl passed from renderer
    rendererInternals) {
        if (n1 == null) {
            mountSuspense(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, rendererInternals);
        }
        else {
            patchSuspense(n1, n2, container, anchor, parentComponent, isSVG, optimized, rendererInternals);
        }
    }
};
function mountSuspense(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, rendererInternals) {
    const { patch, options: { createElement } } = rendererInternals;
    const hiddenContainer = createElement('div');
    const suspense = (n2.suspense = createSuspenseBoundary(n2, parentSuspense, parentComponent, container, hiddenContainer, anchor, isSVG, optimized, rendererInternals));
    const { content, fallback } = normalizeSuspenseChildren(n2);
    suspense.subTree = content;
    suspense.fallbackTree = fallback;
    // start mounting the content subtree in an off-dom container
    patch(null, content, hiddenContainer, null, parentComponent, suspense, isSVG, optimized);
    // now check if we have encountered any async deps
    if (suspense.deps > 0) {
        // mount the fallback tree
        patch(null, fallback, container, anchor, parentComponent, null, // fallback tree will not have suspense context
        isSVG, optimized);
        n2.el = fallback.el;
    }
    else {
        // Suspense has no async deps. Just resolve.
        suspense.resolve();
    }
}
function patchSuspense(n1, n2, container, anchor, parentComponent, isSVG, optimized, { patch }) {
    const suspense = (n2.suspense = n1.suspense);
    suspense.vnode = n2;
    const { content, fallback } = normalizeSuspenseChildren(n2);
    const oldSubTree = suspense.subTree;
    const oldFallbackTree = suspense.fallbackTree;
    if (!suspense.isResolved) {
        patch(oldSubTree, content, suspense.hiddenContainer, null, parentComponent, suspense, isSVG, optimized);
        if (suspense.deps > 0) {
            // still pending. patch the fallback tree.
            patch(oldFallbackTree, fallback, container, anchor, parentComponent, null, // fallback tree will not have suspense context
            isSVG, optimized);
            n2.el = fallback.el;
        }
        // If deps somehow becomes 0 after the patch it means the patch caused an
        // async dep component to unmount and removed its dep. It will cause the
        // suspense to resolve and we don't need to do anything here.
    }
    else {
        // just normal patch inner content as a fragment
        patch(oldSubTree, content, container, anchor, parentComponent, suspense, isSVG, optimized);
        n2.el = content.el;
    }
    suspense.subTree = content;
    suspense.fallbackTree = fallback;
}
function createSuspenseBoundary(vnode, parent, parentComponent, container, hiddenContainer, anchor, isSVG, optimized, rendererInternals) {
    const { patch, move, unmount, next, options: { parentNode } } = rendererInternals;
    const suspense = {
        vnode,
        parent,
        parentComponent,
        isSVG,
        optimized,
        container,
        hiddenContainer,
        anchor,
        deps: 0,
        subTree: null,
        fallbackTree: null,
        isResolved: false,
        isUnmounted: false,
        effects: [],
        resolve() {
            if (__DEV__) {
                if (suspense.isResolved) {
                    throw new Error(`resolveSuspense() is called on an already resolved suspense boundary.`);
                }
                if (suspense.isUnmounted) {
                    throw new Error(`resolveSuspense() is called on an already unmounted suspense boundary.`);
                }
            }
            const { vnode, subTree, fallbackTree, effects, parentComponent, container } = suspense;
            // this is initial anchor on mount
            let { anchor } = suspense;
            // unmount fallback tree
            if (fallbackTree.el) {
                // if the fallback tree was mounted, it may have been moved
                // as part of a parent suspense. get the latest anchor for insertion
                anchor = next(fallbackTree);
                unmount(fallbackTree, parentComponent, suspense, true);
            }
            // move content from off-dom container to actual container
            move(subTree, container, anchor);
            const el = (vnode.el = subTree.el);
            // suspense as the root node of a component...
            if (parentComponent && parentComponent.subTree === vnode) {
                parentComponent.vnode.el = el;
                updateHOCHostEl(parentComponent, el);
            }
            // check if there is a pending parent suspense
            let parent = suspense.parent;
            let hasUnresolvedAncestor = false;
            while (parent) {
                if (!parent.isResolved) {
                    // found a pending parent suspense, merge buffered post jobs
                    // into that parent
                    parent.effects.push(...effects);
                    hasUnresolvedAncestor = true;
                    break;
                }
                parent = parent.parent;
            }
            // no pending parent suspense, flush all jobs
            if (!hasUnresolvedAncestor) {
                queuePostFlushCb(effects);
            }
            suspense.isResolved = true;
            // invoke @resolve event
            const onResolve = vnode.props && vnode.props.onResolve;
            if (isFunction(onResolve)) {
                onResolve();
            }
        },
        recede() {
            suspense.isResolved = false;
            const { vnode, subTree, fallbackTree, parentComponent, container, hiddenContainer, isSVG, optimized } = suspense;
            // move content tree back to the off-dom container
            const anchor = next(subTree);
            move(subTree, hiddenContainer, null);
            // remount the fallback tree
            patch(null, fallbackTree, container, anchor, parentComponent, null, // fallback tree will not have suspense context
            isSVG, optimized);
            const el = (vnode.el = fallbackTree.el);
            // suspense as the root node of a component...
            if (parentComponent && parentComponent.subTree === vnode) {
                parentComponent.vnode.el = el;
                updateHOCHostEl(parentComponent, el);
            }
            // invoke @recede event
            const onRecede = vnode.props && vnode.props.onRecede;
            if (isFunction(onRecede)) {
                onRecede();
            }
        },
        move(container, anchor) {
            move(suspense.isResolved ? suspense.subTree : suspense.fallbackTree, container, anchor);
            suspense.container = container;
        },
        next() {
            return next(suspense.isResolved ? suspense.subTree : suspense.fallbackTree);
        },
        registerDep(instance, setupRenderEffect) {
            // suspense is already resolved, need to recede.
            // use queueJob so it's handled synchronously after patching the current
            // suspense tree
            if (suspense.isResolved) {
                queueJob(() => {
                    suspense.recede();
                });
            }
            suspense.deps++;
            instance
                .asyncDep.catch(err => {
                handleError(err, instance, 0 /* SETUP_FUNCTION */);
            })
                .then(asyncSetupResult => {
                // retry when the setup() promise resolves.
                // component may have been unmounted before resolve.
                if (instance.isUnmounted || suspense.isUnmounted) {
                    return;
                }
                suspense.deps--;
                // retry from this component
                instance.asyncResolved = true;
                const { vnode } = instance;
                if (__DEV__) {
                    pushWarningContext(vnode);
                }
                handleSetupResult(instance, asyncSetupResult, suspense);
                setupRenderEffect(instance, parentComponent, suspense, vnode, 
                // component may have been moved before resolve
                parentNode(instance.subTree.el), next(instance.subTree), isSVG);
                updateHOCHostEl(instance, vnode.el);
                if (__DEV__) {
                    popWarningContext();
                }
                if (suspense.deps === 0) {
                    suspense.resolve();
                }
            });
        },
        unmount(parentSuspense, doRemove) {
            suspense.isUnmounted = true;
            unmount(suspense.subTree, parentComponent, parentSuspense, doRemove);
            if (!suspense.isResolved) {
                unmount(suspense.fallbackTree, parentComponent, parentSuspense, doRemove);
            }
        }
    };
    return suspense;
}
function normalizeSuspenseChildren(vnode) {
    const { shapeFlag, children } = vnode;
    if (shapeFlag & 32 /* SLOTS_CHILDREN */) {
        const { default: d, fallback } = children;
        return {
            content: normalizeVNode(isFunction(d) ? d() : d),
            fallback: normalizeVNode(isFunction(fallback) ? fallback() : fallback)
        };
    }
    else {
        return {
            content: normalizeVNode(children),
            fallback: normalizeVNode(null)
        };
    }
}
export function queueEffectWithSuspense(fn, suspense) {
    if (suspense !== null && !suspense.isResolved) {
        if (isArray(fn)) {
            suspense.effects.push(...fn);
        }
        else {
            suspense.effects.push(fn);
        }
    }
    else {
        queuePostFlushCb(fn);
    }
}
