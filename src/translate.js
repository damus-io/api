
const util = require('./server_helpers')
const crypto = require('crypto')
const current_time = require('./utils').current_time
const SUPPORTED_TRANSLATION_PROVIDERS = new Set(["mock", "noswhere", "deepl"])
let translation_provider = null

if (!process.env.TRANSLATION_PROVIDER) {
  throw new Error("expected TRANSLATION_PROVIDER")
}

if (!SUPPORTED_TRANSLATION_PROVIDERS.has(process.env.TRANSLATION_PROVIDER)) {
  throw new Error("translation provider not supported")
}

// this is safe, as the input value is restricted to known good ones.
translation_provider = new (require("./translate/" + process.env.TRANSLATION_PROVIDER + ".js"))()

async function validate_payload(payload) {
  if (typeof payload.source !== "string")
    return { ok: false, message: 'bad source' }
  if (typeof payload.target !== "string")
    return { ok: false, message: 'bad target' }
  if (typeof payload.q !== "string")
    return { ok: false, message: 'bad q' }
  if (!translation_provider.canTranslate(payload.source, payload.target))
    return { ok: false, message: 'invalid translation source/target' }

  return { ok: true, message: 'valid' }
}

function hash_payload(payload) {
  const hash = crypto.createHash('sha256')
  hash.update(payload.q)
  hash.update(payload.source.toUpperCase())
  hash.update(payload.target.toUpperCase())
  return hash.digest()
}

async function translate_payload(api, res, payload, trans_id) {
  // we might already be translating this
  const job = api.translation.queue[trans_id]
  if (job) {
    try {
      let result = await job
      return util.json_response(res, { text: result.text })
    } catch(e) {
      console.error("translation error: %o", e)
      return util.error_response(res, 'translation error')
    }
  }

  // we might have it in the database already
  const translation = api.dbs.translations.get(trans_id)
  if (translation) {
    const text = translation.text
    if (text == null)
      return util.error_response(res, 'translation fetch error')
    return util.json_response(res, { text })
  }

  const new_job = translation_provider.translate(payload.source, payload.target, payload.q)
  api.translation.queue[trans_id] = new_job

  let result

  try {
    result = await new_job
  } catch(e) {
    console.error("translation error: %o", e)
    return util.error_response(res, 'translation error')
  } finally {
    delete api.translation.queue[trans_id]
  }
  // return results immediately
  util.json_response(res, { text: result.text })

  // write result to db
  await api.dbs.translations.put(trans_id, {
    text: result.text,
    translated_at: current_time(),
    payload: payload
  })
}

function payload_is_data(q) {
  try {
    return Object.keys(JSON.parse(q)).length > 0
  } catch {
    return false
  }
}

async function handle_translate(api, req, res) {
  let id
  try {
    const source = req.query.source.toLowerCase()
    const target = req.query.target.toLowerCase()
    const q = req.query.q
    if (payload_is_data(q))
      return util.invalid_request(res, `payload is data`)
    const payload = { source, target, q }
    const validation_res = await validate_payload(payload)
    if (validation_res.ok === false)
      return util.invalid_request(res, validation_res.message)
    id = hash_payload(payload)
    return translate_payload(api, res, payload, id)
  } catch (err) {
    if (id)
      delete api.translation.queue[id]
    util.invalid_request(res, `error processing request: ${err}`)
  }
}

module.exports = handle_translate
