module.exports = class NoswhereTranslator {
    #noswhereURL = process.env.NOSWHERE_URL || 'https://translate.api.noswhere.com/api'
    #noswhereKey = process.env.NOSWHERE_KEY
    #type = "default"
    #fromLangs = new Set()
    #toLangs = new Set()
    constructor() {
        if (!this.#noswhereKey)
            throw new Error("expected NOSWHERE_KEY env var")
        this.#loadTranslationLangs().catch((err) => {
            console.error("error loading noswhere translation langs: %o", err)
        })
    }
    #getRequestId(resp) {
        return resp.headers?.get?.("x-noswhere-request") || "unknown"
    }
    #getBodySnippet(body) {
        if (typeof body !== "string" || body.length === 0) return "<empty>"
        if (body.length <= 500) return body
        return body.slice(0, 500) + "...(truncated)"
    }
    async #parseResponse(resp, action) {
        const requestId = this.#getRequestId(resp)
        const body = await resp.text()
        try {
            return JSON.parse(body)
        } catch (err) {
            console.error("noswhere %s response parse error: status=%s ok=%s request=%s body=%o", action, resp.status, resp.ok, requestId, this.#getBodySnippet(body))
            throw new Error(`error ${action}: invalid JSON response from Noswhere (request: ${requestId})`)
        }
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
        let data = await this.#parseResponse(resp, "getting translation langs")
        if (!resp.ok) {
            throw new Error(`error getting translation langs: API failed with ${resp.status} ${data.error} (request: ${this.#getRequestId(resp)})`)
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

        let data = await this.#parseResponse(resp, "translating")
        if (!resp.ok) {
            throw new Error(`error translating: API failed with ${resp.status} ${data.error} (request: ${this.#getRequestId(resp)})`)
        }

        if (data.result) {
            return {
                text: data.result
            }
        }

        throw new Error("error translating: no response")
    }
}
