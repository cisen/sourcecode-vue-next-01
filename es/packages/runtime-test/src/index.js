import { createRenderer } from '@vue/runtime-core';
import { nodeOps } from './nodeOps';
import { patchProp } from './patchProp';
import { serializeInner } from './serialize';
const { render, createApp } = createRenderer({
    patchProp,
    ...nodeOps
});
export { render, createApp };
// convenience for one-off render validations
export function renderToString(vnode) {
    const root = nodeOps.createElement('div');
    render(vnode, root);
    return serializeInner(root);
}
export * from './triggerEvent';
export * from './serialize';
export * from './nodeOps';
export * from './utils/mockWarn';
export * from '@vue/runtime-core';
