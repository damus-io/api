module.exports = class NoswhereTranslator {
    #noswhereURL = process.env.NOSWHERE_URL || 'https://translate.api.noswhere.com/api'
    #noswhereKey = process.env.NOSWHERE_KEY
    #type = "default"
    #fromLangs = new Set()
    #toLangs = new Set()
    constructor() {
        if (!this.#noswhereKey)
            throw new Error("expected NOSWHERE_KEY env var")
        this.#loadTranslationLangs()
    }
    async #loadTranslationLangs() {
        let resp = await fetch(this.#noswhereURL + "/langs", {
            method: 'GET',
            timeout: 5000,
            headers: {
                'X-Noswhere-Key': this.#noswhereKey,
                'Content-Type': 'application/json'
            }
        })
        let data = await resp.json()
        if (!resp.ok) {
            throw new Error(`error getting translation langs: API failed with ${resp.status} ${data.error} (request: ${resp.headers.get("x-noswhere-request")})`)
        }
        if (!data[this.#type]) {
            throw new Error(`type ${this.#type} not supported for translation`)
        }
        this.#fromLangs = new Set(data[this.#type].from)
        this.#toLangs = new Set(data[this.#type].to)
    }
    canTranslate(from_lang, to_lang) {
        if (this.#fromLangs.size === 0) return true // assume true until we get the list of languages
        return this.#fromLangs.has(from_lang) && this.#toLangs.has(to_lang)
    }
    async translate(from_lang, to_lang, text) {
        let resp = await fetch(this.#noswhereURL + "/translate", {
            method: 'POST',
            headers: {
                'X-Noswhere-Key': this.#noswhereKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                src_lang: from_lang,
                dst_lang: to_lang,
            })
        })

        let data = await resp.json()
        if (!resp.ok) {
            throw new Error(`error translating: API failed with ${resp.status} ${data.error} (request: ${resp.headers.get("x-noswhere-request")})`)
        }

        if (data.result) {
            return {
                text: data.result
            }
        }

        throw new Error("error translating: no response")
    }
}
