import { h, withDirectives, ref, render, nodeOps, nextTick } from '@vue/runtime-test';
import { currentInstance } from '../src/component';
describe('directives', () => {
    it('should work', async () => {
        const count = ref(0);
        function assertBindings(binding) {
            expect(binding.value).toBe(count.value);
            expect(binding.arg).toBe('foo');
            expect(binding.instance).toBe(_instance && _instance.renderProxy);
            expect(binding.modifiers && binding.modifiers.ok).toBe(true);
        }
        const beforeMount = jest.fn(((el, binding, vnode, prevVNode) => {
            expect(el.tag).toBe('div');
            // should not be inserted yet
            expect(el.parentNode).toBe(null);
            expect(root.children.length).toBe(0);
            assertBindings(binding);
            expect(vnode).toBe(_vnode);
            expect(prevVNode).toBe(null);
        }));
        const mounted = jest.fn(((el, binding, vnode, prevVNode) => {
            expect(el.tag).toBe('div');
            // should be inserted now
            expect(el.parentNode).toBe(root);
            expect(root.children[0]).toBe(el);
            assertBindings(binding);
            expect(vnode).toBe(_vnode);
            expect(prevVNode).toBe(null);
        }));
        const beforeUpdate = jest.fn(((el, binding, vnode, prevVNode) => {
            expect(el.tag).toBe('div');
            expect(el.parentNode).toBe(root);
            expect(root.children[0]).toBe(el);
            // node should not have been updated yet
            expect(el.children[0].text).toBe(`${count.value - 1}`);
            assertBindings(binding);
            expect(vnode).toBe(_vnode);
            expect(prevVNode).toBe(_prevVnode);
        }));
        const updated = jest.fn(((el, binding, vnode, prevVNode) => {
            expect(el.tag).toBe('div');
            expect(el.parentNode).toBe(root);
            expect(root.children[0]).toBe(el);
            // node should have been updated
            expect(el.children[0].text).toBe(`${count.value}`);
            assertBindings(binding);
            expect(vnode).toBe(_vnode);
            expect(prevVNode).toBe(_prevVnode);
        }));
        const beforeUnmount = jest.fn(((el, binding, vnode, prevVNode) => {
            expect(el.tag).toBe('div');
            // should be removed now
            expect(el.parentNode).toBe(root);
            expect(root.children[0]).toBe(el);
            assertBindings(binding);
            expect(vnode).toBe(_vnode);
            expect(prevVNode).toBe(null);
        }));
        const unmounted = jest.fn(((el, binding, vnode, prevVNode) => {
            expect(el.tag).toBe('div');
            // should have been removed
            expect(el.parentNode).toBe(null);
            expect(root.children.length).toBe(0);
            assertBindings(binding);
            expect(vnode).toBe(_vnode);
            expect(prevVNode).toBe(null);
        }));
        let _instance = null;
        let _vnode = null;
        let _prevVnode = null;
        const Comp = {
            setup() {
                _instance = currentInstance;
            },
            render() {
                _prevVnode = _vnode;
                _vnode = withDirectives(h('div', count.value), [
                    [
                        {
                            beforeMount,
                            mounted,
                            beforeUpdate,
                            updated,
                            beforeUnmount,
                            unmounted
                        },
                        // value
                        count.value,
                        // argument
                        'foo',
                        // modifiers
                        { ok: true }
                    ]
                ]);
                return _vnode;
            }
        };
        const root = nodeOps.createElement('div');
        render(h(Comp), root);
        expect(beforeMount).toHaveBeenCalled();
        expect(mounted).toHaveBeenCalled();
        count.value++;
        await nextTick();
        expect(beforeUpdate).toHaveBeenCalled();
        expect(updated).toHaveBeenCalled();
        render(null, root);
        expect(beforeUnmount).toHaveBeenCalled();
        expect(unmounted).toHaveBeenCalled();
    });
    it('should work with a function directive', async () => {
        const count = ref(0);
        function assertBindings(binding) {
            expect(binding.value).toBe(count.value);
            expect(binding.arg).toBe('foo');
            expect(binding.instance).toBe(_instance && _instance.renderProxy);
            expect(binding.modifiers && binding.modifiers.ok).toBe(true);
        }
        const fn = jest.fn(((el, binding, vnode, prevVNode) => {
            expect(el.tag).toBe('div');
            expect(el.parentNode).toBe(root);
            assertBindings(binding);
            expect(vnode).toBe(_vnode);
            expect(prevVNode).toBe(_prevVnode);
        }));
        let _instance = null;
        let _vnode = null;
        let _prevVnode = null;
        const Comp = {
            setup() {
                _instance = currentInstance;
            },
            render() {
                _prevVnode = _vnode;
                _vnode = withDirectives(h('div', count.value), [
                    [
                        fn,
                        // value
                        count.value,
                        // argument
                        'foo',
                        // modifiers
                        { ok: true }
                    ]
                ]);
                return _vnode;
            }
        };
        const root = nodeOps.createElement('div');
        render(h(Comp), root);
        expect(fn).toHaveBeenCalledTimes(1);
        count.value++;
        await nextTick();
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
