// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]
export function patchClass(el, value, isSVG) {
    // directly setting className should be faster than setAttribute in theory
    if (isSVG) {
        el.setAttribute('class', value);
    }
    else {
        el.className = value;
    }
}
