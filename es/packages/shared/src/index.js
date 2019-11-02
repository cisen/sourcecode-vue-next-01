import { makeMap } from './makeMap';
export { makeMap };
export * from './patchFlags';
export { isGloballyWhitelisted } from './globalsWhitelist';
export const EMPTY_OBJ = __DEV__
    ? Object.freeze({})
    : {};
export const EMPTY_ARR = [];
export const NOOP = () => { };
/**
 * Always return false.
 */
export const NO = () => false;
export const isOn = (key) => key[0] === 'o' && key[1] === 'n';
export const extend = (a, b) => {
    for (const key in b) {
        ;
        a[key] = b[key];
    }
    return a;
};
const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (val, key) => hasOwnProperty.call(val, key);
export const isArray = Array.isArray;
export const isFunction = (val) => typeof val === 'function';
export const isString = (val) => typeof val === 'string';
export const isSymbol = (val) => typeof val === 'symbol';
export const isObject = (val) => val !== null && typeof val === 'object';
export function isPromise(val) {
    return isObject(val) && isFunction(val.then) && isFunction(val.catch);
}
export const objectToString = Object.prototype.toString;
export const toTypeString = (value) => objectToString.call(value);
export function toRawType(value) {
    return toTypeString(value).slice(8, -1);
}
export const isPlainObject = (val) => toTypeString(val) === '[object Object]';
export const isReservedProp = /*#__PURE__*/ makeMap('key,ref,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted');
const camelizeRE = /-(\w)/g;
export const camelize = (str) => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
};
const hyphenateRE = /\B([A-Z])/g;
export const hyphenate = (str) => {
    return str.replace(hyphenateRE, '-$1').toLowerCase();
};
export const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value, oldValue) => value !== oldValue && (value === value || oldValue === oldValue);
