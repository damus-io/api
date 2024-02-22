"use strict";
// @ts-check

const test = require('tap').test;
const { PurpleTestController } = require('./controllers/purple_test_controller.js');
const { PURPLE_ONE_MONTH } = require('../src/invoicing.js');

test('LN Flow — Expected flow', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();

  t.same(response.statusCode, 404);

  // Get products
  const products_response = await purple_api_controller.clients[user_pubkey_1].get_products();

  t.same(products_response.statusCode, 200);
  t.same(Object.entries(products_response.body).length, 2); // 2 products for now
  for (const [template_name, product] of Object.entries(products_response.body)) {
    t.type(template_name, 'string');
    t.type(product.description, 'string');
    if (product.special_label) {
      t.type(product.special_label, 'string');
    }
    t.type(product.amount_msat, 'number');
    t.type(product.expiry, 'number');
  }

  // Start a new checkout
  const new_checkout_response = await purple_api_controller.clients[user_pubkey_1].new_checkout(PURPLE_ONE_MONTH);

  t.same(new_checkout_response.statusCode, 200);
  t.ok(new_checkout_response.body.id);
  t.same(new_checkout_response.body.product_template_name, PURPLE_ONE_MONTH);

  // Read the checkout status (to simulate the client polling the server for the status of the checkout)
  const get_checkout_1_response = await purple_api_controller.clients[user_pubkey_1].get_checkout(new_checkout_response.body.id);
  
  t.same(get_checkout_1_response.statusCode, 200);
  t.same(get_checkout_1_response.body.product_template_name, PURPLE_ONE_MONTH);
  t.same(get_checkout_1_response.body.verified_pubkey, null);
  t.same(get_checkout_1_response.body.invoice, null);
  t.same(get_checkout_1_response.body.completed, false);
  
  // Verify the checkout
  const verify_checkout_response = await purple_api_controller.clients[user_pubkey_1].verify_checkout(new_checkout_response.body.id);
  t.same(verify_checkout_response.statusCode, 200);
  t.same(verify_checkout_response.body.product_template_name, PURPLE_ONE_MONTH);
  t.same(verify_checkout_response.body.verified_pubkey, user_pubkey_1);
  t.ok(verify_checkout_response.body.invoice);
  t.ok(verify_checkout_response.body.invoice?.bolt11);
  t.ok(verify_checkout_response.body.invoice?.label);
  t.ok(verify_checkout_response.body.invoice?.connection_params);
  t.ok(verify_checkout_response.body.invoice?.connection_params?.nodeid);
  t.ok(verify_checkout_response.body.invoice?.connection_params?.address);
  t.ok(verify_checkout_response.body.invoice?.connection_params?.rune);
  t.same(verify_checkout_response.body.invoice?.paid, undefined);
  t.same(verify_checkout_response.body.completed, false);
  
  // Read the checkout status again
  const get_checkout_2_response = await purple_api_controller.clients[user_pubkey_1].get_checkout(new_checkout_response.body.id);
  t.same(get_checkout_2_response.statusCode, 200);
  t.same(get_checkout_2_response.body.product_template_name, PURPLE_ONE_MONTH);
  t.same(get_checkout_2_response.body.verified_pubkey, user_pubkey_1);
  t.same(get_checkout_2_response.body.invoice?.bolt11, verify_checkout_response.body.invoice?.bolt11);
  t.same(get_checkout_2_response.body.invoice?.label, verify_checkout_response.body.invoice?.label);
  t.same(get_checkout_2_response.body.invoice?.connection_params?.nodeid, verify_checkout_response.body.invoice?.connection_params?.nodeid);
  t.same(get_checkout_2_response.body.invoice?.connection_params?.address, verify_checkout_response.body.invoice?.connection_params?.address);
  t.same(get_checkout_2_response.body.invoice?.connection_params?.rune, verify_checkout_response.body.invoice?.connection_params?.rune);
  t.same(get_checkout_2_response.body.invoice?.paid, undefined);
  t.same(get_checkout_2_response.body.completed, false);
  
  // Pay the invoice
  const pay_invoice_response = purple_api_controller.mock_ln_node_controller.simulate_pay_for_invoice(get_checkout_2_response.body.invoice?.bolt11);
  
  // Ask the server to check the invoice status
  const check_invoice_status_response = await purple_api_controller.clients[user_pubkey_1].check_invoice(get_checkout_2_response.body.id);
  t.same(check_invoice_status_response.statusCode, 200);
  t.same(check_invoice_status_response.body.invoice?.paid, true);
  t.same(check_invoice_status_response.body.completed, true);
  
  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 200);
  t.same(account_info_response.body.pubkey, user_pubkey_1)
  t.same(account_info_response.body.created_at, purple_api_controller.current_time());
  t.same(account_info_response.body.expiry, purple_api_controller.current_time() + 30 * 24 * 60 * 60);
  t.same(account_info_response.body.subscriber_number, 1);
  t.same(account_info_response.body.active, true);

  t.end();
});

test('LN Flow — Account not active if payment is not complete', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();

  t.same(response.statusCode, 404);

  // Get products
  const products_response = await purple_api_controller.clients[user_pubkey_1].get_products();
  t.same(products_response.statusCode, 200);

  // Start a new checkout
  const new_checkout_response = await purple_api_controller.clients[user_pubkey_1].new_checkout(PURPLE_ONE_MONTH);
  t.same(new_checkout_response.statusCode, 200);
  
  // Verify the checkout
  const verify_checkout_response = await purple_api_controller.clients[user_pubkey_1].verify_checkout(new_checkout_response.body.id);
  t.same(verify_checkout_response.statusCode, 200);
  
  // **DO NOT PAY FOR INVOICE**
  
  // Ask the server to check the invoice status even without paying
  try {
    const res = await purple_api_controller.clients[user_pubkey_1].check_invoice(
      new_checkout_response.body.id, 
      { timeout: { response: 2000, deadline: 2000 } }
    );
  
    t.same(res.statusCode, 200);
    t.same(res.body.invoice?.paid, undefined);
    t.same(res.body.completed, false);
  } catch (err) {
    if (err.timeout) {
      /* timed out! */
      console.log("timeout");
    } else { 
      /* other error */
      throw err;
    }
  }
  
  
  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 404);

  t.end();
  return;
});

test('LN Flow — Renewals, expiration and expiry bumping', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);
  purple_api_controller.set_current_time(1706659200)  // 2024-01-31 00:00:00 UTC

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();
  
  const initial_account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(initial_account_info_response.statusCode, 404);

  // Buy a one month subscription
  await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
  // Check expiry
  const account_info_response_1 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_1.statusCode, 200);
  t.same(account_info_response_1.body.expiry, purple_api_controller.current_time() + 30 * 24 * 60 * 60);
  t.same(account_info_response_1.body.active, true);
  
  // Move time forward by 35 days, and make sure the account is not active anymore
  purple_api_controller.set_current_time(purple_api_controller.current_time() + 35 * 24 * 60 * 60);
  const account_info_response_2 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_2.statusCode, 200);
  t.same(account_info_response_2.body.active, false);
  
  // Buy a one month subscription again
  await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
  // Check expiry
  const account_info_response_3 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_3.statusCode, 200);
  t.same(account_info_response_3.body.expiry, purple_api_controller.current_time() + 30 * 24 * 60 * 60);
  t.same(account_info_response_3.body.active, true);
  
  // Move time forward by 25 days, and make sure the account is still active
  purple_api_controller.set_current_time(purple_api_controller.current_time() + 25 * 24 * 60 * 60);
  const account_info_response_4 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_4.statusCode, 200);
  t.same(account_info_response_4.body.active, true);
  
  // Buy another one month subscription again
  await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
  // Check expiry and make sure it's 35 days from now
  const account_info_response_5 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_5.statusCode, 200);
  t.same(account_info_response_5.body.expiry, purple_api_controller.current_time() + 35 * 24 * 60 * 60);
  t.same(account_info_response_5.body.active, true);
  
  t.end();
});
