"use strict";
// @ts-check

const test = require('tap').test;
const { PurpleTestController } = require('./controllers/purple_test_controller.js');
const { PURPLE_ONE_MONTH } = require('../src/invoicing.js');
const { v4: uuidv4 } = require('uuid');

test('OTP login flow — Expected flow', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Let's get them an account
  await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);

  // Get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(response.statusCode, 200);

  // Let's request an OTP
  const test_otp = "432931";
  purple_api_controller.web_auth_controller.set_next_random_otp(test_otp);
  const otp_response = await purple_api_controller.clients[user_pubkey_1].request_otp();
  t.same(otp_response.statusCode, 200);
  t.same(otp_response.body, { success: true });

  // Let's try to login with the correct OTP
  const login_response = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp);
  t.same(login_response.statusCode, 200);
  t.same(login_response.body.valid, true);
  t.ok(login_response.body.session_token);

  // Try to fetch the account info again via the session token
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account_with_session_token(login_response.body.session_token);
  t.same(account_info_response.statusCode, 200);
  t.ok(account_info_response.body.active);
  t.ok(account_info_response.body.expiry);
  t.ok(account_info_response.body.subscriber_number);
  t.ok(account_info_response.body.created_at);
  t.ok(account_info_response.body.testflight_url);
  
  t.end();
});

test('OTP login flow — Wrong session token should not work', async (t) => {
    // Initialize the PurpleTestController
    const purple_api_controller = await PurpleTestController.new(t);
  
    // Instantiate a new client
    const user_pubkey_1 = purple_api_controller.new_client();
  
    // Let's get them an account
    await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
    // Get the account info
    const response = await purple_api_controller.clients[user_pubkey_1].get_account();
    t.same(response.statusCode, 200);
  
    // Let's request an OTP
    const test_otp = "982932";
    purple_api_controller.web_auth_controller.set_next_random_otp(test_otp);
    const otp_response = await purple_api_controller.clients[user_pubkey_1].request_otp();
    t.same(otp_response.statusCode, 200);
    t.same(otp_response.body, { success: true });
  
    // Let's try to login with the correct OTP to generate a session token
    const login_response = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp);
    t.same(login_response.statusCode, 200);
    t.same(login_response.body.valid, true);
    t.ok(login_response.body.session_token);
  
    // Try to fetch the account info again via the session token
    const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account_with_session_token(uuidv4());
    t.same(account_info_response.statusCode, 401);
    
    t.end();
});

test('OTP login flow — Wrong OTP should not work', async (t) => {
    // Initialize the PurpleTestController
    const purple_api_controller = await PurpleTestController.new(t);
  
    // Instantiate a new client
    const user_pubkey_1 = purple_api_controller.new_client();
  
    // Let's get them an account
    await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
    // Get the account info
    const response = await purple_api_controller.clients[user_pubkey_1].get_account();
    t.same(response.statusCode, 200);
  
    // Let's request an OTP
    const test_otp = 982932;
    purple_api_controller.web_auth_controller.set_next_random_otp(test_otp);
    const otp_response = await purple_api_controller.clients[user_pubkey_1].request_otp();
    t.same(otp_response.statusCode, 200);
    t.same(otp_response.body, { success: true });
  
    // Let's try to login with the correct OTP to generate a session token
    const login_response = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp + 1);
    t.same(login_response.statusCode, 401);
    t.notOk(login_response.body.valid);
    t.notOk(login_response.body.session_token);
    
    t.end();
});

test('OTP login flow — Too many OTP attempts should not work', async (t) => {
    // Initialize the PurpleTestController
    const purple_api_controller = await PurpleTestController.new(t);
  
    // Instantiate a new client
    const user_pubkey_1 = purple_api_controller.new_client();
  
    // Let's get them an account
    await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
    // Get the account info
    const response = await purple_api_controller.clients[user_pubkey_1].get_account();
    t.same(response.statusCode, 200);
  
    // Let's request an OTP
    const test_otp = "100011";
    purple_api_controller.web_auth_controller.set_next_random_otp(test_otp);
    const otp_response = await purple_api_controller.clients[user_pubkey_1].request_otp();
    t.same(otp_response.statusCode, 200);
    t.same(otp_response.body, { success: true });
  
    // Let's try to login with the correct OTP to generate a session token
    for (let i = 0; i < process.env.OTP_MAX_TRIES+1; i++) {
        const try_otp = (100000 + i).toString();
        const login_response = await purple_api_controller.clients[user_pubkey_1].verify_otp(try_otp);
        t.same(login_response.statusCode, 401);
        t.notOk(login_response.body.valid);
        t.notOk(login_response.body.session_token);
    }
    const login_response = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp);
    t.same(login_response.statusCode, 401); // This should be 401 because the user has tried too many times
    t.notOk(login_response.body.valid);
    t.notOk(login_response.body.session_token);

    // Let's request another OTP
    const test_otp_2 = "765421";
    purple_api_controller.web_auth_controller.set_next_random_otp(test_otp_2);
    const otp_response_2 = await purple_api_controller.clients[user_pubkey_1].request_otp();
    t.same(otp_response_2.statusCode, 200);
    t.same(otp_response_2.body, { success: true });

    // Let's try to login with the correct OTP to generate a session token
    const login_response_2 = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp_2);
    t.same(login_response_2.statusCode, 200); // This should be 200 because the OTP is still valid
    t.ok(login_response_2.body.valid);
    t.ok(login_response_2.body.session_token);
    
    t.end();
});

test('OTP login flow — Expired OTP should not work', async (t) => {
    // Initialize the PurpleTestController
    const purple_api_controller = await PurpleTestController.new(t);

    const test_start_time = 1711731587;  // 2024-03-29
    purple_api_controller.set_current_time(test_start_time)  // 2024-03-29
  
    // Instantiate a new client
    const user_pubkey_1 = purple_api_controller.new_client();
  
    // Let's get them an account
    await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
    // Get the account info
    const response = await purple_api_controller.clients[user_pubkey_1].get_account();
    t.same(response.statusCode, 200);
  
    // Let's request an OTP
    const test_otp = "560930";
    purple_api_controller.web_auth_controller.set_next_random_otp(test_otp);
    const otp_response = await purple_api_controller.clients[user_pubkey_1].request_otp();
    t.same(otp_response.statusCode, 200);
    t.same(otp_response.body, { success: true });

    purple_api_controller.set_current_time(test_start_time + process.env.OTP_EXPIRY + 1)  // Several minutes later
  
    const login_response = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp);
    t.same(login_response.statusCode, 401); // This should be 401 because the OTP has expired
    t.notOk(login_response.body.valid);
    t.notOk(login_response.body.session_token);

    // Let's request another OTP
    const test_otp_2 = "765421";
    purple_api_controller.web_auth_controller.set_next_random_otp(test_otp_2);
    const otp_response_2 = await purple_api_controller.clients[user_pubkey_1].request_otp();
    t.same(otp_response_2.statusCode, 200);
    t.same(otp_response_2.body, { success: true });

    // Let's try to login with the correct OTP to generate a session token
    const login_response_2 = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp_2);
    t.same(login_response_2.statusCode, 200); // This should be 200 because the OTP is still valid
    t.ok(login_response_2.body.valid);
    t.ok(login_response_2.body.session_token);
    
    t.end();
});

test('OTP login flow — Session token should expire', async (t) => {
    // Initialize the PurpleTestController
    const purple_api_controller = await PurpleTestController.new(t);

    const test_start_time = 1711731587;  // 2024-03-29

    purple_api_controller.set_current_time(test_start_time)  // 2024-03-29
  
    // Instantiate a new client
    const user_pubkey_1 = purple_api_controller.new_client();
  
    // Let's get them an account
    await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
    // Get the account info
    const response = await purple_api_controller.clients[user_pubkey_1].get_account();
    t.same(response.statusCode, 200);
  
    // Let's request an OTP
    const test_otp = "560930";
    purple_api_controller.web_auth_controller.set_next_random_otp(test_otp);
    const otp_response = await purple_api_controller.clients[user_pubkey_1].request_otp();
    t.same(otp_response.statusCode, 200);
    t.same(otp_response.body, { success: true });
  
    const login_response = await purple_api_controller.clients[user_pubkey_1].verify_otp(test_otp);
    t.same(login_response.statusCode, 200); // This should be 200 because the OTP is still valid
    t.ok(login_response.body.valid);
    t.ok(login_response.body.session_token);

    purple_api_controller.set_current_time(test_start_time + process.env.SESSION_EXPIRY + 1)  // Several days later

    const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account_with_session_token(login_response.body.session_token);
    t.same(account_info_response.statusCode, 401); // This should be 401 because the session token has expired
    
    t.end();
});
