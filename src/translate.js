
const util = require('./server_helpers')
const crypto = require('crypto')
const current_time = require('./utils').current_time

const translate_sources = new Set(['BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR', 'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL', 'PL', 'PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TR', 'UK', 'ZH'])
const translate_targets = new Set(['BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'EN-GB', 'EN-US', 'ES', 'ET', 'FI', 'FR', 'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL', 'PL', 'PT', 'PT-BR', 'PT-PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TR', 'UK', 'ZH'])

const DEEPL_KEY = process.env.DEEPL_KEY
const DEEPL_URL = process.env.DEEPL_URL || 'https://api.deepl.com/v2/translate'

if (!DEEPL_KEY)
  throw new Error("expected DEEPL_KEY env var")

async function validate_payload(payload) {
  if (!payload.source)
    return { ok: false, message: 'missing source' }
  if (!payload.target)
    return { ok: false, message: 'missing target' }
  if (!payload.q)
    return { ok: false, message: 'missing q' }
  if (!translate_sources.has(payload.source))
    return { ok: false, message: 'invalid translation source' }
  if (!translate_targets.has(payload.target))
    return { ok: false, message: 'invalid translation target' }

  return { ok: true, message: 'valid' }
}

function hash_payload(payload) {
  const hash = crypto.createHash('sha256')
  hash.update(payload.q)
  hash.update(payload.source)
  hash.update(payload.target)
  return hash.digest()
}

async function deepl_translate_text(payload) {
  let resp = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [payload.q],
      source_lang: payload.source,
      target_lang: payload.target,
    })
  })

  let data = await resp.json()

  if (data.translations && data.translations.length > 0) {
    return data.translations[0].text;
  }

  return null
}

async function translate_payload(api, res, payload, trans_id) {
  // we might already be translating this
  const job = api.translation.queue[trans_id]
  if (job) {
    let text = await job
    if (text === null)
      return util.error_response(res, 'deepl translation error')

    return util.json_response(res, { text })
  }

  // we might have it in the database already
  const translation = api.dbs.translations.get(trans_id)
  if (translation) {
    const text = translation.text
    if (text == null)
      return util.error_response(res, 'translation fetch error')
    return util.json_response(res, { text })
  }

  const new_job = deepl_translate_text(payload)
  api.translation.queue[trans_id] = new_job

  let text = await new_job
  if (text === null) {
    delete api.translation.queue[trans_id]
    return util.error_response(res, 'deepl translation error')
  }

  // return results immediately
  util.json_response(res, { text })

  // write result to db
  await api.dbs.translations.put(trans_id, {
    text: text,
    translated_at: current_time(),
    payload: payload
  })

  delete api.translation.queue[trans_id]
}

async function handle_translate(api, req, res) {
  let id
  try {
    const source = req.query.source.toUpperCase()
    const target = req.query.target.toUpperCase()
    const q = req.query.q
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
    throw err
  }
}

module.exports = handle_translate
