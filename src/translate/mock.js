module.exports = class MockTranslator {
    constructor() {

    }
    canTranslate(from_lang, to_lang) {
        return true
    }
    async translate(from_lang, to_lang, text) {
        return {
            text: "Mock translation"
        }
    }
}