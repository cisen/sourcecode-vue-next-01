// This package is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { compile } from '@vue/compiler-dom';
import { registerRuntimeCompiler } from '@vue/runtime-dom';
import * as runtimeDom from '@vue/runtime-dom';
function compileToFunction(template, options) {
    const { code } = compile(template, {
        hoistStatic: true,
        ...options
    });
    return new Function('Vue', code)(runtimeDom);
}
registerRuntimeCompiler(compileToFunction);
export { compileToFunction as compile };
export * from '@vue/runtime-dom';
if (__BROWSER__ && __DEV__) {
    console[console.info ? 'info' : 'log'](`You are running a development build of Vue.\n` +
        `Make sure to use the production build (*.prod.js) when deploying for production.`);
}
