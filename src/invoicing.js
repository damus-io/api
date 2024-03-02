const LNSocket = require('lnsocket')
const { bump_expiry } = require('./user_management')
const { nip19 } = require('nostr-tools')
const { v4: uuidv4 } = require('uuid')

const PURPLE_ONE_MONTH = "purple_one_month"
const PURPLE_ONE_YEAR = "purple_one_year"
const PURGE_OLD_INVOICES = false  // Disabled for now as we would like to keep records of all invoices
const LN_INVOICE_INSTRUCTIONS = `
INSTRUCTIONS:
1. Pay for this invoice using your Lightning wallet.
2. Once paid, please go back to the checkout page you were on. In iOS you can use the app switcher to go back to the browser.
3. Follow the instructions on the checkout page to complete checkout.
`;

function getInvoiceTemplates() {
  return process.env.TEST_PRODUCTS ?
    {
      "purple_one_month": {
        description: "Purple (1 mo) (test)",
        special_label: null,
        amount_msat: 1000,  // Make a cheap invoice for testing
        expiry: 30 * 24 * 60 * 60 // 30 days
      },
      "purple_one_year": {
        description: "Purple (1 yr) (test)",
        special_label: "Save 16%!",
        amount_msat: 1000,  // Make a cheap invoice for testing
        expiry: 365 * 24 * 60 * 60 // 365 days
      }
    }
    :
    {
      "purple_one_month": {
        description: "Purple (One Month)",
        special_label: null,
        // TODO: Make this value change based on the exchange rate of BTC vs USD (or not? 1 BTC = 1 BTC, USD is a shitcoin since 1971)
        amount_msat: 15000 * 1000, // 15k sats / month
        expiry: 30 * 24 * 60 * 60 // 30 days
      },
      "purple_one_year": {
        description: "Purple (One Year)",
        special_label: "Save 16%!",
        // TODO: Make this value change based on the exchange rate of BTC vs USD (or not? 1 BTC = 1 BTC, USD is a shitcoin since 1971)
        amount_msat: 15000 * 10 * 1000, // 150k sats / year
        expiry: 365 * 24 * 60 * 60 // 365 days
      }
    }
}

class PurpleInvoiceManager {
  // nodeid: string, address: string, rune: string
  constructor(api, nodeid, address, rune, ws_proxy_address) {
    this.nodeid = nodeid
    this.address = address
    this.rune = rune
    this.ws_proxy_address = ws_proxy_address
    this.invoices_db = api.dbs.invoices
    this.invoice_templates = getInvoiceTemplates()
    this.checkout_sessions_db = api.dbs.checkout_sessions
    this.api = api
  }

  // Connects and initializes this invoice manager
  async connect_and_init() {
    // Purge old invoices every 10 minutes
    if (PURGE_OLD_INVOICES) {
      this.purging_interval_timer = setInterval(() => this.purge_old_invoices(), 10 * 60 * 1000)
    }
  }

  // Purge old invoices from the database
  purge_old_invoices() {
    for (const bolt11 of this.invoices_db.getKeys()) {
      const invoice_request_info = this.invoices_db.get(bolt11)
      const expiry = invoice_request_info.invoice_info.expires_at
      // Delete invoices that expired more than 1 day ago
      if (expiry < current_time() - 24 * 60 * 60) {
        this.invoices_db.del(bolt11)
      }
    }
  }

  // Initiates a new checkout
  async new_checkout(template_name) {
    const checkout_id = uuidv4()
    const checkout_object = {
      id: checkout_id,
      verified_pubkey: null,
      product_template_name: template_name,
      invoice: null,
      completed: false
    }
    await this.checkout_sessions_db.put(checkout_id, checkout_object)
    return checkout_object
  }

  // Verifies the user who is performing the checkout, and automatically generates an invoice for them to pay. Returns the updated checkout object.
  async verify_checkout_object(checkout_id, authorized_pubkey) {
    const checkout_object = this.checkout_sessions_db.get(checkout_id)
    if (!checkout_object) {
      return { request_error: "Invalid checkout_id" }
    }
    if (checkout_object.verified_pubkey) {
      // Do not allow re-verifying a checkout for security and reasons, and to prevent undefined behavior.
      return { request_error: "Checkout already verified" }
    }
    checkout_object.verified_pubkey = authorized_pubkey
    const npub = nip19.npubEncode(authorized_pubkey)
    // This is the only time we generate an invoice in the lifetime of a checkout.
    // It is done during npub verification because it is the only authenticated step in the process.
    // This prevents potential abuse or issues regenerating new invoices and causing the user to pay a stale invoice.
    const invoice_request_info = await this.request_invoice(npub, checkout_object.product_template_name)
    checkout_object.invoice = {
      bolt11: invoice_request_info.invoice_info.bolt11,  // The bolt11 invoice string for the user to pay
      label: invoice_request_info.label,    // The label of the invoice, used to monitor its status
      connection_params: {                  // Connection params to connect to the LN node, to allow the frontend to monitor the invoice status directly
        nodeid: this.nodeid,
        address: this.address,
        rune: this.rune,
        ws_proxy_address: this.ws_proxy_address
      }
    }
    // Update the checkout object since the state has changed. Changes are written all at once to avoid intermittent issues when client requests the checkout object during modification
    await this.checkout_sessions_db.put(checkout_id, checkout_object)
    return { checkout_object }
  }

  // Gets a deep copy of the checkout object
  async get_checkout_object(checkout_id) {
    const checkout_object = this.checkout_sessions_db.get(checkout_id)
    if (!checkout_object) {
      return null
    }
    return checkout_object
  }

  // Checks the status of the invoice associated with the given checkout object directly with the LN node, and handles successful payments.
  async check_checkout_object_invoice(checkout_id) {
    const checkout_object = await this.get_checkout_object(checkout_id)
    if (checkout_object?.invoice) {
      checkout_object.invoice.paid = await this.check_invoice_is_paid(checkout_object.invoice.label)
      if (checkout_object.invoice.paid) {
        this.handle_successful_payment(checkout_object.invoice.bolt11)
        checkout_object.completed = true
        await this.checkout_sessions_db.put(checkout_id, checkout_object)  // Update the checkout object since the state has changed
      }
    }
    return checkout_object
  }

  // Call this when the user wants to checkout a purple subscription and needs an invoice to pay
  async request_invoice(npub, template_name) {
    if (!this.invoice_templates[template_name]) {
      throw new Error("Invalid template name")
    }

    const template = this.invoice_templates[template_name]
    const description = template.description + "\nnpub: " + npub + "\n\n" + LN_INVOICE_INSTRUCTIONS
    const amount_msat = template.amount_msat
    const label = `lnlink-purple-invoice-${uuidv4()}`
    // TODO: In the future, we might want to set specific expiry times and mechanisms to avoid having the user pay a stale/unmonitored invoice, and to relieve the server from having to monitor invoices forever.
    const invoice_info = await this.make_invoice(description, amount_msat, label)
    const invoice_request_info = {
      npub: npub,
      label: label,
      template_name: template_name,
      invoice_info: invoice_info,  // {payment_hash, expires_at, bolt11, payment_secret, created_index}
      paid: false
    }
    const bolt11 = invoice_info.bolt11
    this.invoices_db.put(bolt11, invoice_request_info)
    return invoice_request_info
  }

  // This is called when an invoice is successfully paid
  async handle_successful_payment(bolt11) {
    const invoice_request_info = this.invoices_db.get(bolt11)
    if (!invoice_request_info) {
      throw new Error("Invalid bolt11 or not found")
    }
    invoice_request_info.paid = true
    this.invoices_db.put(bolt11, invoice_request_info)
    const npub = invoice_request_info.npub
    const pubkey = nip19.decode(npub).data.toString('hex')
    const result = bump_expiry(this.api, pubkey, this.invoice_templates[invoice_request_info.template_name].expiry)
    if (!result.account) {
      throw new Error("Could not bump expiry")
    }
  }

  // Lower level function that generates the invoice based on the given parameters
  async make_invoice(description, amount_msat, label) {
    const params = { label, description, amount_msat }
    return (await this.ln_rpc({ method: "invoice", params })).result
  }

  // Checks the status of an invoice once. Returns true if paid, false otherwise.
  async check_invoice_is_paid(label) {
    try {
      const params = { label }
      return new Promise(async (resolve, reject) => {
        setTimeout(() => {
          resolve(undefined)
        }, parseInt(process.env.LN_INVOICE_CHECK_TIMEOUT_MS) || 60000)
        const res = await this.ln_rpc({ method: "waitinvoice", params })
        resolve(res.error ? false : true)
      })
    }
    catch {
      return undefined
    }
  }

  // Performs an RPC call to the LN node
  async ln_rpc(args) {
    const { method, params } = args
    const ln = await PurpleInvoiceManager.LNSocket()
    ln.genkey()
    await ln.connect_and_init(this.nodeid, this.address)
    return await ln.rpc({ rune: this.rune, method, params })
  }

  // Convenience function to get the LNSocket instance, in a way that is easy to mock in tests
  static async LNSocket() {
    return LNSocket()
  }

  // Disconnects from the LN node and stops purging old invoices
  async disconnect() {
    if (this.purging_interval_timer) {
      clearInterval(this.purging_interval_timer)
    }
  }
}

function deep_copy(obj) {
  return JSON.parse(JSON.stringify(obj))
}

module.exports = { PurpleInvoiceManager, PURPLE_ONE_MONTH, PURPLE_ONE_YEAR }
