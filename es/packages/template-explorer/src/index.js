import { compile } from '@vue/compiler-dom';
import { compilerOptions, initOptions } from './options';
import { watch } from '@vue/runtime-dom';
window.init = () => {
    const monaco = window.monaco;
    const persistedState = JSON.parse(decodeURIComponent(window.location.hash.slice(1)) ||
        localStorage.getItem('state') ||
        `{}`);
    Object.assign(compilerOptions, persistedState.options);
    let lastSuccessfulCode = `/* See console for error */`;
    let lastSuccessfulMap = undefined;
    function compileCode(source) {
        console.clear();
        try {
            const errors = [];
            const { code, ast, map } = compile(source, {
                filename: 'template.vue',
                ...compilerOptions,
                sourceMap: true,
                onError: err => {
                    errors.push(err);
                }
            });
            monaco.editor.setModelMarkers(editor.getModel(), `@vue/compiler-dom`, errors.filter(e => e.loc).map(formatError));
            console.log(`AST: `, ast);
            lastSuccessfulCode = code + `\n\n// Check the console for the AST`;
            lastSuccessfulMap = new window._deps['source-map'].SourceMapConsumer(map);
            lastSuccessfulMap.computeColumnSpans();
        }
        catch (e) {
            console.error(e);
        }
        return lastSuccessfulCode;
    }
    function formatError(err) {
        const loc = err.loc;
        return {
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: loc.start.line,
            startColumn: loc.start.column,
            endLineNumber: loc.end.line,
            endColumn: loc.end.column,
            message: `Vue template compilation error: ${err.message}`,
            code: String(err.code)
        };
    }
    function reCompile() {
        const src = editor.getValue();
        // every time we re-compile, persist current state
        const state = JSON.stringify({
            src,
            options: compilerOptions
        });
        localStorage.setItem('state', state);
        window.location.hash = encodeURIComponent(state);
        const res = compileCode(src);
        if (res) {
            output.setValue(res);
        }
    }
    const sharedEditorOptions = {
        theme: 'vs-dark',
        fontSize: 14,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        contextmenu: false,
        minimap: {
            enabled: false
        }
    };
    const editor = monaco.editor.create(document.getElementById('source'), {
        value: persistedState.src || `<div>Hello World!</div>`,
        language: 'html',
        ...sharedEditorOptions
    });
    editor.getModel().updateOptions({
        tabSize: 2
    });
    const output = monaco.editor.create(document.getElementById('output'), {
        value: '',
        language: 'javascript',
        readOnly: true,
        ...sharedEditorOptions
    });
    output.getModel().updateOptions({
        tabSize: 2
    });
    // handle resize
    window.addEventListener('resize', () => {
        editor.layout();
        output.layout();
    });
    // update compile output when input changes
    editor.onDidChangeModelContent(debounce(reCompile));
    // highlight output code
    let prevOutputDecos = [];
    function clearOutputDecos() {
        prevOutputDecos = output.deltaDecorations(prevOutputDecos, []);
    }
    editor.onDidChangeCursorPosition(debounce(e => {
        clearEditorDecos();
        if (lastSuccessfulMap) {
            const pos = lastSuccessfulMap.generatedPositionFor({
                source: 'template.vue',
                line: e.position.lineNumber,
                column: e.position.column - 1
            });
            if (pos.line != null && pos.column != null) {
                prevOutputDecos = output.deltaDecorations(prevOutputDecos, [
                    {
                        range: new monaco.Range(pos.line, pos.column + 1, pos.line, pos.lastColumn ? pos.lastColumn + 2 : pos.column + 2),
                        options: {
                            inlineClassName: `highlight`
                        }
                    }
                ]);
                output.revealPositionInCenter({
                    lineNumber: pos.line,
                    column: pos.column + 1
                });
            }
            else {
                clearOutputDecos();
            }
        }
    }, 100));
    let previousEditorDecos = [];
    function clearEditorDecos() {
        previousEditorDecos = editor.deltaDecorations(previousEditorDecos, []);
    }
    output.onDidChangeCursorPosition(debounce(e => {
        clearOutputDecos();
        if (lastSuccessfulMap) {
            const pos = lastSuccessfulMap.originalPositionFor({
                line: e.position.lineNumber,
                column: e.position.column - 1
            });
            if (pos.line != null &&
                pos.column != null &&
                !(pos.line === 1 && pos.column === 0)) {
                const translatedPos = {
                    column: pos.column + 1,
                    lineNumber: pos.line
                };
                previousEditorDecos = editor.deltaDecorations(previousEditorDecos, [
                    {
                        range: new monaco.Range(pos.line, pos.column + 1, pos.line, pos.column + 1),
                        options: {
                            isWholeLine: true,
                            className: `highlight`
                        }
                    }
                ]);
                editor.revealPositionInCenter(translatedPos);
            }
            else {
                clearEditorDecos();
            }
        }
    }, 100));
    initOptions();
    watch(reCompile);
};
function debounce(fn, delay = 300) {
    let prevTimer = null;
    return ((...args) => {
        if (prevTimer) {
            clearTimeout(prevTimer);
        }
        prevTimer = window.setTimeout(() => {
            fn(...args);
            prevTimer = null;
        }, delay);
    });
}
