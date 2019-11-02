export function triggerEvent(el, event, payload = []) {
    const { eventListeners } = el;
    if (eventListeners) {
        const listener = eventListeners[event];
        if (listener) {
            if (Array.isArray(listener)) {
                for (let i = 0; i < listener.length; i++) {
                    listener[i](...payload);
                }
            }
            else {
                listener(...payload);
            }
        }
    }
}
