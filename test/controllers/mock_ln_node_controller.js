"use strict";

const current_time = require('../../src/utils.js').current_time;
const { v4: uuidv4 } = require('uuid')

class MockLNNodeController {
  // MARK: - Initializers

  /**
   * Initializes the MockLNNodeController
   * 
   * @param {Object} t - The test object from Node tap
   * @param {number} invoice_expiry_period - The period of time in seconds that generated invoices are valid for
   */
  constructor(t, invoice_expiry_period) {
    this.invoice_expiry_period = invoice_expiry_period
    this.control_invoice_should_fail = false
    this.invoices = {}
    this.bolt11_to_label = {}
    this.open_intervals = []
    t.teardown(() => {
      this.open_intervals.forEach((interval) => {
        clearInterval(interval)
      })
    });
  }

  // MARK: - Control functions

  fail_at_next_invoice() {
    this.control_invoice_should_fail = true
  }

  succeed_at_next_invoice() {
    this.control_invoice_should_fail = false
  }

  simulate_pay_for_invoice(bolt11) {
    this.invoices[this.bolt11_to_label[bolt11]].paid = true
  }

  simulate_invoice_error(bolt11) {
    this.invoices[this.bolt11_to_label[bolt11]].error = "Simulated invoice error"
  }

  // MARK: - Mocking LNSocket functions

  /** genkey - Generates a new key
    *
    */
  genkey() {
    // Does nothing yet
  }

  /**
   * Connects to a node and initializes the connection.
   * 
   * @param {string} nodeid - The node ID to connect to.
   * @param {string} address - The address to connect to.
   * @return {Promise<void>} - A promise that resolves when the connection is established.
   */
  connect_and_init(nodeid, address) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 1000)  // Simulate a 1 second delay to make timing more realistic
    })
  }

  /**
   * Sends an RPC request to the node.
   * 
   * @param {LNRPCRequest} rpc - The RPC request to send.
   * @return {Promise<Object>} - A promise that resolves with the response from the RPC request.
   */
  rpc({ rune, method, params }) {
    return new Promise((resolve, reject) => {
      if (method === "invoice") {
        this.generate_invoice(params).then(resolve)
        return
      }
      if (method === "waitinvoice") {
        this.wait_invoice(params).then(resolve)
        return
      }
    })
  }


  // MARK: - Mock RPC helper functions

  /**
   * Generates an invoice.
   * 
   * @param {LNRPCRequestParams} params - The parameters for the invoice.
   * @return {Promise<LNRPCResponse>} - A promise that resolves with the invoice details or an error.
   */
  generate_invoice(params) {
    return new Promise((resolve, reject) => {
      if (this.control_invoice_should_fail) {
        resolve({
          error: "Failed to generate invoice"
        })
      } else {
        const expires_at = current_time() + this.invoice_expiry_period
        const label = params.label
        const bolt11 = "lnbc1" + uuidv4() // Generate a random string for the BOLT11 invoice
        this.invoices[label] = {
          payment_hash: "payment_hash_" + uuidv4(), // Generate a random string for now
          expires_at: expires_at,
          bolt11: bolt11,
          payment_secret: "payment_secret_" + uuidv4(), // Generate a random string for now
          created_index: Object.entries(this.invoices).length + 1,
        }
        this.bolt11_to_label[bolt11] = label
        resolve({
          result: this.invoices[label]
        })
      }
    })
  }

  /**
   * Waits for an invoice to be paid.
   * 
   * @param {LNRPCRequestParams} params - The parameters for the invoice.
   * @return {Promise<LNRPCResponse>} - A promise that resolves with the invoice details or an error.
   */
  wait_invoice(params) {
    return new Promise((resolve, reject) => {
      const label = params.label
      const invoice = this.invoices[label]
      const interval = setInterval(() => {
        if (invoice.paid) {
          clearInterval(interval)
          resolve({
            result: invoice
          })
        }
        if (invoice.error) {
          clearInterval(interval)
          resolve({
            error: invoice.error
          })
        }
      }, 1000)  // Check every second
      this.open_intervals.push(interval)
    })
  }
}

// MARK: - Type definitions


/**
 * @typedef {Object} LNRPCRequest
 * @property {string} rune - The rune to use for the RPC request
 * @property {LNRPCMethod} method - The method to call
 * @property {LNRPCRequestParams} params - The parameters to pass to the method
 * 
 */

/**
* @typedef {"invoice" | "waitinvoice"} LNRPCMethod
*/

/**
* @typedef {Object} LNRPCRequestParams
* @property {string} label - The label for the invoice
* @property {string | undefined} description - The description for the invoice
* @property {number | undefined} amount_msat - The amount in millisatoshis for the invoice
*/

/**
  * @typedef {Object} LNRPCResponse
  * @property {string | undefined} error - The error message if the request failed
  * @property {Object | LNRPCResponseInvoiceResult | undefined} result - The result of the request
*/

/**
  * @typedef {Object} LNRPCResponseInvoiceResult
  {payment_hash, expires_at, bolt11, payment_secret, created_index}
  * @property {string} payment_hash - The payment hash for the invoice
  * @property {number} expires_at - The expiration time for the invoice (Unix timestamp measured in seconds)
  * @property {string} bolt11 - The BOLT11 invoice
  * @property {string} payment_secret - The payment secret for the invoice
  * @property {number} created_index - The index of the invoice
*/


module.exports = {
  MockLNNodeController
}
