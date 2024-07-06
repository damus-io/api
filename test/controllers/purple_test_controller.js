"use strict";
// @ts-check

const { supertest_client } = require('./utils.js');
const fs = require('fs')
const dotenv = require('dotenv');
const { SignedDataVerifier } = require('@apple/app-store-server-library');
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
    this.web_auth_controller = new this.MockWebAuthController(t, this.purple_api.web_auth_manager)
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
    process.env.ENABLE_IAP_PAYMENTS = "true"
    process.env.MOCK_VERIFY_RECEIPT = false
    process.env.IAP_ISSUER_ID = "MOCK"
    process.env.IAP_KEY_ID = "MOCK"
    process.env.IAP_BUNDLE_ID = "com.jb55.damus2"
    process.env.IAP_PRIVATE_KEY_PATH = "./test_utils/mock.p8"
    process.env.IAP_ENVIRONMENT = "Sandbox"
    process.env.OTP_MAX_TRIES = 10
    process.env.SESSION_EXPIRY = 60*60*24*7
    process.env.OTP_EXPIRY = 60*5
    process.env.TESTFLIGHT_URL = "https://testflight.apple.com/join/abc123"
  }

  setup_stubs() {
    this.time = 1706659200  // 2024-01-31 00:00:00 UTC

    const mock_ln_socket = () => {
      return Promise.resolve(this.mock_ln_node_controller)
    }
    
    this.MockIAPController = this.t.mockRequire('./mock_iap_controller.js', {
      '../../src/utils.js': { ...require('../../src/utils.js'), current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket,
    }).MockIAPController;
    
    this.iap = new this.MockIAPController()

    this.PurpleApi = this.t.mockRequire('../../src/index.js', {
      '../../src/utils.js': { ...require('../../src/utils.js'), current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket,
      '@apple/app-store-server-library': {
        ...require('@apple/app-store-server-library'),
        AppStoreServerAPIClient: this.iap.generate_app_store_server_api_client(),
        SignedDataVerifier: this.iap.generate_signed_data_verifier()
      }
    })

    this.MockLNNodeController = this.t.mockRequire('./mock_ln_node_controller.js', {
      '../../src/utils.js': { ...require('../../src/utils.js'), current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket
    }).MockLNNodeController;        

    this.PurpleTestClient = this.t.mockRequire('./purple_test_client.js', {
      '../../src/utils.js': { ...require('../../src/utils.js'), current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket
    }).PurpleTestClient;

    this.MockWebAuthController = this.t.mockRequire('./mock_web_auth_controller.js', {
      '../../src/utils.js': { ...require('../../src/utils.js'), current_time: this.current_time.bind(this) },
      'lnsocket': mock_ln_socket
    }).MockWebAuthController;
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
  
  
  // MARK: - High-level client control
  
  /**
   * Does the LN flow for buying a subscription normally.
   * 
   * @param {string} pubkey - The public key of the client
   * @param {string} product_template_name - The name of the product template
   */
  async ln_flow_buy_subscription(pubkey, product_template_name) {
    const new_checkout_response = await this.clients[pubkey].new_checkout(product_template_name);
    this.t.same(new_checkout_response.status, 200)
    const verify_checkout_response = await this.clients[pubkey].verify_checkout(new_checkout_response.body.id);
    this.t.same(verify_checkout_response.status, 200)
    this.mock_ln_node_controller.simulate_pay_for_invoice(verify_checkout_response.body.invoice?.bolt11);
    const check_invoice_status_response = await this.clients[pubkey].check_invoice(verify_checkout_response.body.id);
    this.t.same(check_invoice_status_response.status, 200)
  }
  
  
  // MARK: - Account UUID control
  
  /**
    * Sets the account UUID for a public key
    *
    * @param {string} pubkey - The public key of the user
    * @param {string} account_uuid - The account UUID to set for the user
    */
  set_account_uuid(pubkey, account_uuid) {
    this.purple_api.dbs.pubkeys_to_user_uuids.put(pubkey, account_uuid)
  }
}

module.exports = { PurpleTestController }
