import { isObject } from '@vue/shared';
import { warn } from '../warning';
// For prefixing keys in v-on="obj" with "on"
export function toHandlers(obj) {
    const ret = {};
    if (__DEV__ && !isObject(obj)) {
        warn(`v-on with no argument expects an object value.`);
        return ret;
    }
    for (const key in obj) {
        ret[`on${key}`] = obj[key];
    }
    return ret;
}
