const translate_sources = new Set([
    'bg', 'cs', 'da', 'de', 'el',
    'en', 'es', 'et', 'fi', 'fr',
    'hu', 'id', 'it', 'ja', 'ko',
    'lt', 'lv', 'nb', 'nl', 'pl',
    'pt', 'ro', 'ru', 'sk', 'sl',
    'sv', 'tr', 'uk', 'zh'
])
const translate_targets = new Set([
    'bg', 'cs', 'da', 'de',
    'el', 'en', 'en-gb', 'en-us',
    'es', 'et', 'fi', 'fr',
    'hu', 'id', 'it', 'ja',
    'ko', 'lt', 'lv', 'nb',
    'nl', 'pl', 'pt', 'pt-br',
    'pt-pt', 'ro', 'ru', 'sk',
    'sl', 'sv', 'tr', 'uk',
    'zh'
])

module.exports = class DeepLTranslator {
    #deeplURL = process.env.DEEPL_URL || 'https://api.deepl.com/v2/translate'
    #deeplKey = process.env.DEEPL_KEY
    constructor() {
        if (!this.#deeplKey)
            throw new Error("expected DEEPL_KEY env var")
    }
    canTranslate(from_lang, to_lang) {
        return translate_sources.has(from_lang) && translate_targets.has(to_lang)
    }
    async translate(from_lang, to_lang, text) {
        let resp = await fetch(this.#deeplURL, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${this.#deeplKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: [text],
                source_lang: from_lang.toUpperCase(),
                target_lang: to_lang.toUpperCase(),
            })
        })

        if (!resp.ok) throw new Error("error translating: API failed with " + resp.status + " " + resp.statusText)

        let data = await resp.json()

        if (data.translations && data.translations.length > 0) {
            return {
                text: data.translations[0].text
            }
        }

        throw new Error("error translating: no response")
    }
}