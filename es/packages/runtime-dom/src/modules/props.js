export function patchDOMProp(el, key, value, 
// the following args are passed only due to potential innerHTML/textContent
// overriding existing VNodes, in which case the old tree must be properly
// unmounted.
prevChildren, parentComponent, parentSuspense, unmountChildren) {
    if ((key === 'innerHTML' || key === 'textContent') && prevChildren != null) {
        unmountChildren(prevChildren, parentComponent, parentSuspense);
    }
    if (key === 'value' && el.tagName !== 'PROGRESS') {
        // store value as _value as well since
        // non-string values will be stringified.
        el._value = value;
    }
    if (value === '' && typeof el[key] === 'boolean') {
        // e.g. <select multiple> compiles to { multiple: '' }
        el[key] = true;
    }
    else {
        el[key] = value == null ? '' : value;
    }
}
