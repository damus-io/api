"use strict";
// @ts-check
const nostr = require('nostr');
const crypto = require('crypto');
const { hash_sha256, current_time } = require('../../src/utils.js');


class PurpleTestClient {
  // MARK: - Initializers

  /**
   * Initializes the PurpleTestClient
   * 
   * @param {Object} t - The test object
   * @param {Object} supertest_client - The supertest client to use for the test
   * @param {string} base_url - The base URL to use for the test
   * @param {string | undefined} private_key - The private key to use for the test
   */
  constructor(t, supertest_client, base_url, private_key) {
    this.t = t
    this.request = supertest_client
    this.base_url = base_url
    this.private_key = private_key || crypto.randomBytes(32).toString('hex')
    this.public_key = nostr.getPublicKey(this.private_key)
  }


  // MARK: - Client high-level functions

  /**
     * Gets the account information for the current public key.
     * 
     * @param {PurpleTestClientRequestOptions} options - The request options
     * @returns {Promise<Object>} The account information
     */
  async get_account(options = {}) {
    options = PurpleTestClient.patch_options({ nip98_authenticated: true }, options)
    return await this.get('/accounts/' + this.public_key, options)
  }

  /**
   * Gets the product template options.
   * 
   * @param {PurpleTestClientRequestOptions} options - The request options
   * @returns {Promise<Object>} The product information
   */
  async get_products(options = {}) {
    return await this.get('/products', options)
  }

  /**
     * Creates a new checkout.
     *
     * @param {string} product_template_name - The name of the product template
     * @param {PurpleTestClientRequestOptions} options - The request options
     * @returns {Promise<Object>} The result of the checkout creation
     */
  async new_checkout(product_template_name, options = {}) {
    options = PurpleTestClient.patch_options({ nip98_authenticated: true, content_type: 'application/json' }, options)
    return await this.post('/ln-checkout',
      { product_template_name: product_template_name },
      {
        nip98_authenticated: false,
        content_type: 'application/json'
      }
    )
  }

  /**
   * Gets a checkout.
   *
   * @param {string} checkout_id - The ID of the checkout
   * @param {PurpleTestClientRequestOptions} options - The request options
   * @returns {Promise<Object>} The checkout information
   */
  async get_checkout(checkout_id, options = {}) {
    return await this.get('/ln-checkout/' + checkout_id, options)
  }

  /**
   * Verifies a checkout.
   * 
   * @param {string} checkout_id - The ID of the checkout
   * @param {PurpleTestClientRequestOptions} options - The request options
   * @returns {Promise<Object>} The result of the checkout verification
   */
  async verify_checkout(checkout_id, options = {}) {
    options = PurpleTestClient.patch_options({ nip98_authenticated: true }, options)
    return await this.put('/ln-checkout/' + checkout_id + '/verify', null, options)
  }

  /**
   * Checks an invoice for a given checkout.
   * 
   * @param {string} checkout_id - The ID of the checkout
   * @param {PurpleTestClientRequestOptions} options - The request options
   * @returns {Promise<Object>} The result of the invoice check
   */
  async check_invoice(checkout_id, options = {}) {
    options = PurpleTestClient.patch_options({}, options)
    return await this.post('/ln-checkout/' + checkout_id + '/check-invoice', null, options)
  }


  /**
   * Sends a GET request to the server.
   * 
   * @param {string} path - The path to send the request to.
   * @param {PurpleTestClientRequestOptions} options - The request options.
   * @returns {Promise<Object>} The response from the server.
   */
  async get(path, options = {}) {
    return await this.make_request('GET', path, null, options)
  }

  /**
   * Sends a POST request to the server.
   * 
   * @param {string} path - The path to send the request to.
   * @param {Object} body - The body of the request.
   * @param {PurpleTestClientRequestOptions} options - The request options.
   * @returns {Promise<Object>} The response from the server.
   */
  async post(path, body, options = {}) {
    return await this.make_request('POST', path, body, options)
  }

  /**
     * Sends a PUT request to the server.
     * 
     * @param {string} path - The path to send the request to.
     * @param {Object} body - The body of the request.
     * @param {PurpleTestClientRequestOptions} options - The request options.
     * @returns {Promise<Object>} The response from the server.
     */
  async put(path, body, options = {}) {
    return await this.make_request('PUT', path, body, options)
  }


  // MARK: - Client internal functions

  /**
   * Makes a request to the server.
   *
   * @param {HTTPMethod} method - The HTTP method
   * @param {string} path - The path
   * @param {string | null} body - The body
   * @param {PurpleTestClientRequestOptions} options - The request options
   * @returns {Promise<Object>} The response from the server
   */
  async make_request(method, path, body, options = {}) {
    var request = this.request
    if (method === 'GET') {
      request = request.get(path)
    }
    else if (method === 'POST') {
      request = request.post(path)
    }
    else if (method === 'PUT') {
      request = request.put(path)
    }
    else {
      throw new Error('Invalid method')
    }
    // Authentication
    if (options?.nip98_authenticated) {
      request = request.set('Authorization', await this.get_nip98_auth_header(method, path, body))
    }
    // Content type
    if (options?.content_type) {
      request = request.set('Content-Type', options.content_type)
    }
    // Body
    if (body !== null && body !== undefined) {
      request = request.send(body)
    }
    return await request
  }

  /**
     * Generates a NIP98 auth header.
     * 
     * @param {HTTPMethod} method - The HTTP method
     * @param {string} path - The path
     * @param {string | null} body - The body
     * @returns {Promise<string>} The NIP98 auth header
     */
  async get_nip98_auth_header(method, path, body) {
    let full_query_url = this.base_url + path
    var body_hash = ''
    if (body !== null && body !== undefined) {
      body_hash = hash_sha256(JSON.stringify(body))
    }

    let auth_note_template = {
      pubkey: this.public_key,
      created_at: current_time(),
      kind: 27235,
      tags: [
        ["u", full_query_url],
        ["method", method],
      ],
      content: body_hash
    }

    let auth_note_id = await nostr.calculateId(auth_note_template);
    let auth_note_sig = await nostr.signId(this.private_key, auth_note_id);
    let auth_note = {
      ...auth_note_template,
      id: auth_note_id,
      sig: auth_note_sig
    }
    let auth_note_base64 = Buffer.from(JSON.stringify(auth_note)).toString('base64');

    return `Nostr ${auth_note_base64}`
  }

  /**
   * Patches the options. Useful for setting default options, and then overriding them.
   * 
   * @param {PurpleTestClientRequestOptions} default_options - The default options
   * @param {PurpleTestClientRequestOptions} patch - The patch to override the default options
   * @returns {PurpleTestClientRequestOptions} The patched options
   */
  static patch_options(default_options, patch) {
    var options = { ...default_options }
    for (let key in patch) {
      options[key] = patch[key] === undefined ? options[key] : patch[key]
    }
    return options
  }

}


// MARK: - Type definitions

/**
 * @typedef {"GET" | "POST" | "PUT"} HTTPMethod
*/

/**
 * @typedef {Object} PurpleTestClientRequestOptions
 * 
 * @property {boolean} [nip98_authenticated] - Whether the request should be authenticated with NIP98
 * @property {string} [content_type] - The content type of the request
 * @property {{ response: number, deadline: number }} [timeout] - The timeout of the request
 * 
*/

module.exports = { PurpleTestClient }
