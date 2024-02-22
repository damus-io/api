"use strict";
// @ts-check

const { supertest_client } = require('./utils.js');
const fs = require('fs')
const dotenv = require('dotenv')
/**
 * @typedef {import('./purple_test_client.js').PurpleTestClient} PurpleTestClient
 */


class PurpleTestController {
  // MARK: - Initializers
  
  /**
   * Initializes the PurpleTestController
   * 
   * @param {Object} t - The test object
   */
  constructor(t) {
    this.t = t
    this.setup_stubs()
    this.set_env_vars()
    this.setup_db()
    this.purple_api = this.PurpleApi()
    this.purple_api.register_routes()
    this.test_request = null  // Will be set in connect_and_init
    this.mock_ln_node_controller = new this.MockLNNodeController(t, 24 * 60 * 60)  // 24 hours expiry for the invoices
    /**
     * This is a list of clients that can be used to interact with the test Purple API
     * @type {Record<string, PurpleTestClient>}
    */
    this.clients = {}
  }

  set_env_vars() {
    dotenv.config()
    process.env.DB_PATH = process.env.TEST_DB_PATH || '/tmp/purple_test_db_' + Math.random().toString(36).substring(7)
    process.env.LN_NODE_ID = 'ln_node_id'
    process.env.LN_NODE_ADDRESS = 'ln_node_address'
    process.env.LN_RUNE = 'ln_rune'
    process.env.LN_WS_PROXY = 'ln_ws_proxy'
    process.env.DEEPL_KEY = 'deepl_key'
    process.env.ENABLE_HTTP_AUTH = 'true' // Enable HTTP auth for tests
    process.env.LN_INVOICE_CHECK_TIMEOUT_MS = '5000'
  }

  setup_stubs() {
    this.time = 1706659200  // 2024-01-31 00:00:00 UTC

    const mock_ln_socket = () => {
      return Promise.resolve(this.mock_ln_node_controller)
    }

    this.PurpleApi = this.t.mockRequire('../../src/index.js', {
      '../../src/utils.js': { current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket
    })

    this.MockLNNodeController = this.t.mockRequire('./mock_ln_node_controller.js', {
      '../../src/utils.js': { current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket
    }).MockLNNodeController;

    this.PurpleTestClient = this.t.mockRequire('./purple_test_client.js', {
      '../../src/utils.js': { current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket
    }).PurpleTestClient;
  }

  async connect_and_init() {
    this.test_request = await supertest_client(this.purple_api.router, this.t);
  }

  static async new(t) {
    const controller = new PurpleTestController(t)
    await controller.connect_and_init()
    return controller
  }

  // MARK: - Test database helpers
  
  /** 
   * setup_db - Sets up the test database.
   * Ensure that process.env.DB_PATH is set to a unique path before calling this method by calling `set_env_vars`.
   */
  setup_db() {
    this.delete_db_if_exists()
    // Clean up when the test is done
    this.t.teardown(async () => {
        this.delete_db_if_exists()
    })
  }
  
  /**
   * Deletes the test database if it exists.
   */
  delete_db_if_exists() {
    if (fs.existsSync(process.env.DB_PATH)) {
      fs.rmdirSync(process.env.DB_PATH, { recursive: true })
    }
  }
  
  /**
   * Returns the paths to the database files.
   * 
   * @return {Array<string>} The paths to the database files.
   */
  get_db_paths() {
    return [
      process.env.DB_PATH + "/data.mdb",
      process.env.DB_PATH + "/lock.mdb"
    ]
  }
  
  
  // MARK: - Time control
  
  
  /**
   * set_current_time - Sets the current time to a specific value
   * 
   * @param {number} time - The time to set the current time to (UNIX timestamp measured in seconds)
   */
  set_current_time(time) {
    this.time = time
  }
  
  current_time() {
    return this.time
  }

  // MARK: - Client control
  
  
  /**  new_client - Creates a new PurpleTestClient
   *
   * @param {string | undefined} private_key - The private key to use for the client
   * @return {string} - The new client's public key (which can be used to access the client via `controller.clients[public_key]`)
   */
  new_client(private_key=undefined) {
    const client = new this.PurpleTestClient(this.t, this.test_request, this.purple_api.router.base_url, private_key)
    this.clients[client.public_key] = client
    return client.public_key
  }
  
}

module.exports = { PurpleTestController }
