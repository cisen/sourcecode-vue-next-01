import { parserOptionsMinimal } from './parserOptionsMinimal';
import namedCharacterReferences from './namedChars.json';
export const parserOptionsStandard = {
    // extends the minimal options with more spec-compliant overrides
    ...parserOptionsMinimal,
    // https://html.spec.whatwg.org/multipage/named-characters.html#named-character-references
    namedCharacterReferences
};
