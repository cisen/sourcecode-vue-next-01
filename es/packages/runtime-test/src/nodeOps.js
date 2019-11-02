import { markNonReactive } from '@vue/reactivity';
let nodeId = 0;
let recordedNodeOps = [];
export function logNodeOp(op) {
    recordedNodeOps.push(op);
}
export function resetOps() {
    recordedNodeOps = [];
}
export function dumpOps() {
    const ops = recordedNodeOps.slice();
    resetOps();
    return ops;
}
function createElement(tag) {
    const node = {
        id: nodeId++,
        type: "element" /* ELEMENT */,
        tag,
        children: [],
        props: {},
        parentNode: null,
        eventListeners: null
    };
    logNodeOp({
        type: "create" /* CREATE */,
        nodeType: "element" /* ELEMENT */,
        targetNode: node,
        tag
    });
    // avoid test nodes from being observed
    markNonReactive(node);
    return node;
}
function createText(text) {
    const node = {
        id: nodeId++,
        type: "text" /* TEXT */,
        text,
        parentNode: null
    };
    logNodeOp({
        type: "create" /* CREATE */,
        nodeType: "text" /* TEXT */,
        targetNode: node,
        text
    });
    // avoid test nodes from being observed
    markNonReactive(node);
    return node;
}
function createComment(text) {
    const node = {
        id: nodeId++,
        type: "comment" /* COMMENT */,
        text,
        parentNode: null
    };
    logNodeOp({
        type: "create" /* CREATE */,
        nodeType: "comment" /* COMMENT */,
        targetNode: node,
        text
    });
    // avoid test nodes from being observed
    markNonReactive(node);
    return node;
}
function setText(node, text) {
    logNodeOp({
        type: "setText" /* SET_TEXT */,
        targetNode: node,
        text
    });
    node.text = text;
}
function insert(child, parent, ref) {
    let refIndex;
    if (ref != null) {
        refIndex = parent.children.indexOf(ref);
        if (refIndex === -1) {
            console.error('ref: ', ref);
            console.error('parent: ', parent);
            throw new Error('ref is not a child of parent');
        }
    }
    logNodeOp({
        type: "insert" /* INSERT */,
        targetNode: child,
        parentNode: parent,
        refNode: ref
    });
    // remove the node first, but don't log it as a REMOVE op
    remove(child, false);
    // re-calculate the ref index because the child's removal may have affected it
    refIndex = ref ? parent.children.indexOf(ref) : -1;
    if (refIndex === -1) {
        parent.children.push(child);
        child.parentNode = parent;
    }
    else {
        parent.children.splice(refIndex, 0, child);
        child.parentNode = parent;
    }
}
function remove(child, logOp = true) {
    const parent = child.parentNode;
    if (parent != null) {
        if (logOp) {
            logNodeOp({
                type: "remove" /* REMOVE */,
                targetNode: child,
                parentNode: parent
            });
        }
        const i = parent.children.indexOf(child);
        if (i > -1) {
            parent.children.splice(i, 1);
        }
        else {
            console.error('target: ', child);
            console.error('parent: ', parent);
            throw Error('target is not a childNode of parent');
        }
        child.parentNode = null;
    }
}
function setElementText(el, text) {
    logNodeOp({
        type: "setElementText" /* SET_ELEMENT_TEXT */,
        targetNode: el,
        text
    });
    el.children.forEach(c => {
        c.parentNode = null;
    });
    if (!text) {
        el.children = [];
    }
    else {
        el.children = [
            {
                id: nodeId++,
                type: "text" /* TEXT */,
                text,
                parentNode: el
            }
        ];
    }
}
function parentNode(node) {
    return node.parentNode;
}
function nextSibling(node) {
    const parent = node.parentNode;
    if (!parent) {
        return null;
    }
    const i = parent.children.indexOf(node);
    return parent.children[i + 1] || null;
}
function querySelector() {
    throw new Error('querySelector not supported in test renderer.');
}
export const nodeOps = {
    insert,
    remove,
    createElement,
    createText,
    createComment,
    setText,
    setElementText,
    parentNode,
    nextSibling,
    querySelector
};
