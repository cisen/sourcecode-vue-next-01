import { readonly, toRaw, lock, unlock } from '@vue/reactivity';
import { EMPTY_OBJ, camelize, hyphenate, capitalize, isString, isFunction, isArray, isObject, isReservedProp, hasOwn, toRawType, makeMap } from '@vue/shared';
import { warn } from './warning';
// resolve raw VNode data.
// - filter out reserved keys (key, ref, slots)
// - extract class and style into $attrs (to be merged onto child
//   component root)
// - for the rest:
//   - if has declared props: put declared ones in `props`, the rest in `attrs`
//   - else: everything goes in `props`.
export function resolveProps(instance, rawProps, _options) {
    const hasDeclaredProps = _options != null;
    const options = normalizePropsOptions(_options);
    if (!rawProps && !hasDeclaredProps) {
        return;
    }
    const props = {};
    let attrs = void 0;
    // update the instance propsProxy (passed to setup()) to trigger potential
    // changes
    const propsProxy = instance.propsProxy;
    const setProp = propsProxy
        ? (key, val) => {
            props[key] = val;
            propsProxy[key] = val;
        }
        : (key, val) => {
            props[key] = val;
        };
    // allow mutation of propsProxy (which is readonly by default)
    unlock();
    if (rawProps != null) {
        for (const key in rawProps) {
            // key, ref are reserved
            if (isReservedProp(key))
                continue;
            // prop option names are camelized during normalization, so to support
            // kebab -> camel conversion here we need to camelize the key.
            const camelKey = camelize(key);
            if (hasDeclaredProps && !hasOwn(options, camelKey)) {
                // Any non-declared props are put into a separate `attrs` object
                // for spreading. Make sure to preserve original key casing
                ;
                (attrs || (attrs = {}))[key] = rawProps[key];
            }
            else {
                setProp(camelKey, rawProps[key]);
            }
        }
    }
    // set default values, cast booleans & run validators
    if (hasDeclaredProps) {
        for (const key in options) {
            let opt = options[key];
            if (opt == null)
                continue;
            const isAbsent = !hasOwn(props, key);
            const hasDefault = hasOwn(opt, 'default');
            const currentValue = props[key];
            // default values
            if (hasDefault && currentValue === undefined) {
                const defaultValue = opt.default;
                setProp(key, isFunction(defaultValue) ? defaultValue() : defaultValue);
            }
            // boolean casting
            if (opt["1" /* shouldCast */]) {
                if (isAbsent && !hasDefault) {
                    setProp(key, false);
                }
                else if (opt["2" /* shouldCastTrue */] &&
                    (currentValue === '' || currentValue === hyphenate(key))) {
                    setProp(key, true);
                }
            }
            // runtime validation
            if (__DEV__ && rawProps) {
                let rawValue;
                if (!(key in rawProps) && hyphenate(key) in rawProps) {
                    rawValue = rawProps[hyphenate(key)];
                }
                else {
                    rawValue = rawProps[key];
                }
                validateProp(key, toRaw(rawValue), opt, isAbsent);
            }
        }
    }
    else {
        // if component has no declared props, $attrs === $props
        attrs = props;
    }
    // in case of dynamic props, check if we need to delete keys from
    // the props proxy
    const { patchFlag } = instance.vnode;
    if (propsProxy !== null &&
        (patchFlag === 0 || patchFlag & 16 /* FULL_PROPS */)) {
        const rawInitialProps = toRaw(propsProxy);
        for (const key in rawInitialProps) {
            if (!hasOwn(props, key)) {
                delete propsProxy[key];
            }
        }
    }
    // lock readonly
    lock();
    instance.props = __DEV__ ? readonly(props) : props;
    instance.attrs = options
        ? __DEV__ && attrs != null
            ? readonly(attrs)
            : attrs || EMPTY_OBJ
        : instance.props;
}
const normalizationMap = new WeakMap();
function normalizePropsOptions(raw) {
    if (!raw) {
        return null;
    }
    if (normalizationMap.has(raw)) {
        return normalizationMap.get(raw);
    }
    const normalized = {};
    normalizationMap.set(raw, normalized);
    if (isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
            if (__DEV__ && !isString(raw[i])) {
                warn(`props must be strings when using array syntax.`, raw[i]);
            }
            const normalizedKey = camelize(raw[i]);
            if (normalizedKey[0] !== '$') {
                normalized[normalizedKey] = EMPTY_OBJ;
            }
            else if (__DEV__) {
                warn(`Invalid prop name: "${normalizedKey}" is a reserved property.`);
            }
        }
    }
    else {
        if (__DEV__ && !isObject(raw)) {
            warn(`invalid props options`, raw);
        }
        for (const key in raw) {
            const normalizedKey = camelize(key);
            if (normalizedKey[0] !== '$') {
                const opt = raw[key];
                const prop = (normalized[normalizedKey] =
                    isArray(opt) || isFunction(opt) ? { type: opt } : opt);
                if (prop != null) {
                    const booleanIndex = getTypeIndex(Boolean, prop.type);
                    const stringIndex = getTypeIndex(String, prop.type);
                    prop["1" /* shouldCast */] = booleanIndex > -1;
                    prop["2" /* shouldCastTrue */] = booleanIndex < stringIndex;
                }
            }
            else if (__DEV__) {
                warn(`Invalid prop name: "${normalizedKey}" is a reserved property.`);
            }
        }
    }
    return normalized;
}
// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor) {
    const match = ctor && ctor.toString().match(/^\s*function (\w+)/);
    return match ? match[1] : '';
}
function isSameType(a, b) {
    return getType(a) === getType(b);
}
function getTypeIndex(type, expectedTypes) {
    if (isArray(expectedTypes)) {
        for (let i = 0, len = expectedTypes.length; i < len; i++) {
            if (isSameType(expectedTypes[i], type)) {
                return i;
            }
        }
    }
    else if (isObject(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1;
    }
    return -1;
}
function validateProp(name, value, prop, isAbsent) {
    const { type, required, validator } = prop;
    // required!
    if (required && isAbsent) {
        warn('Missing required prop: "' + name + '"');
        return;
    }
    // missing but optional
    if (value == null && !prop.required) {
        return;
    }
    // type check
    if (type != null && type !== true) {
        let isValid = false;
        const types = isArray(type) ? type : [type];
        const expectedTypes = [];
        // value is valid as long as one of the specified types match
        for (let i = 0; i < types.length && !isValid; i++) {
            const { valid, expectedType } = assertType(value, types[i]);
            expectedTypes.push(expectedType || '');
            isValid = valid;
        }
        if (!isValid) {
            warn(getInvalidTypeMessage(name, value, expectedTypes));
            return;
        }
    }
    // custom validator
    if (validator && !validator(value)) {
        warn('Invalid prop: custom validator check failed for prop "' + name + '".');
    }
}
const isSimpleType = /*#__PURE__*/ makeMap('String,Number,Boolean,Function,Symbol');
function assertType(value, type) {
    let valid;
    const expectedType = getType(type);
    if (isSimpleType(expectedType)) {
        const t = typeof value;
        valid = t === expectedType.toLowerCase();
        // for primitive wrapper objects
        if (!valid && t === 'object') {
            valid = value instanceof type;
        }
    }
    else if (expectedType === 'Object') {
        valid = toRawType(value) === 'Object';
    }
    else if (expectedType === 'Array') {
        valid = isArray(value);
    }
    else {
        valid = value instanceof type;
    }
    return {
        valid,
        expectedType
    };
}
function getInvalidTypeMessage(name, value, expectedTypes) {
    let message = `Invalid prop: type check failed for prop "${name}".` +
        ` Expected ${expectedTypes.map(capitalize).join(', ')}`;
    const expectedType = expectedTypes[0];
    const receivedType = toRawType(value);
    const expectedValue = styleValue(value, expectedType);
    const receivedValue = styleValue(value, receivedType);
    // check if we need to specify expected value
    if (expectedTypes.length === 1 &&
        isExplicable(expectedType) &&
        !isBoolean(expectedType, receivedType)) {
        message += ` with value ${expectedValue}`;
    }
    message += `, got ${receivedType} `;
    // check if we need to specify received value
    if (isExplicable(receivedType)) {
        message += `with value ${receivedValue}.`;
    }
    return message;
}
function styleValue(value, type) {
    if (type === 'String') {
        return `"${value}"`;
    }
    else if (type === 'Number') {
        return `${Number(value)}`;
    }
    else {
        return `${value}`;
    }
}
function isExplicable(type) {
    const explicitTypes = ['string', 'number', 'boolean'];
    return explicitTypes.some(elem => type.toLowerCase() === elem);
}
function isBoolean(...args) {
    return args.some(elem => elem.toLowerCase() === 'boolean');
}
