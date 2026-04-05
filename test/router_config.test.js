const test = require('tap').test;
const express = require('express');
const config_router = require('../src/router_config.js').config_router;
const nostr = require('nostr');
const current_time = require('../src/utils.js').current_time;
const { get_account_info_payload } = require('../src/user_management.js');
const { supertest_client } = require('./controllers/utils.js');
const { v4: uuidv4 } = require('uuid')

test('config_router - Account management routes', async (t) => {
  const account_info = {
    pubkey: 'abc123',
    created_at: current_time() - 60 * 60 * 24 * 30, // 30 days ago
    expiry: current_time() + 60 * 60 * 24 * 30 // 30 days
  };
  const pubkeys_to_user_ids = {
    'abc123': 1
  };
  const accounts = {
    1: account_info
  }

  const app = {
    router: express(),
    dbs: {
      accounts: {
        get: (id) => {
          return accounts[id]
        },
        put: (id, account) => {
          accounts[id] = account
        },
        getKeys: (options) => {
          if (options && options.reverse) {
            return Object.keys(accounts).reverse()
          }
          return Object.keys(accounts)
        }
      },
      pubkeys_to_user_ids: {
        get: (pubkey) => {
          return pubkeys_to_user_ids[pubkey]
        },
        put: (pubkey, user_id) => {
          pubkeys_to_user_ids[pubkey] = user_id
        },
        getKeys: (options) => {
          if (options.reverse) {
            return Object.keys(pubkeys_to_user_ids).reverse()
          }
          return Object.keys(pubkeys_to_user_ids)
        }
      },
      pubkeys_to_user_uuids: {
        get: (pubkey) => {
          return uuidv4()
        },
        put: (pubkey, user_uuid) => {
          return
        },
        getKeys: (options) => {
          return Object.keys(pubkeys_to_user_ids)
        }
      }

    },
    web_auth_manager: {
      require_web_auth: async (req, res, next) => {
        req.authorized_pubkey = 'abc123';
        next();
      },
      use_web_auth: async (req, res, next) => {
        req.authorized_pubkey = 'abc123';
        next();
      }
    }
  };

  const request = await supertest_client(app.router, t);

  config_router(app);

  t.test('should handle a valid GET request for an existing account ', async (t) => {
    const res = await request
      .get('/accounts/abc123')
      .expect(200);

    t.equal(res.body.pubkey, account_info.pubkey)
    t.equal(res.body.created_at, account_info.created_at)
    t.equal(res.body.subscriber_number, 1)
    t.equal(res.body.expiry, account_info.expiry)
    t.equal(res.body.active, true)
    t.equal(res.body.testflight_url, null)
    t.equal(res.body.attributes.member_for_more_than_one_year, false)
    // Legacy account with 30-day past + 30-day future expiry yields ~60 days of membership
    const sixty_days = 60 * 24 * 60 * 60
    t.ok(res.body.attributes.active_membership_duration > sixty_days - 10, 'duration should be approximately 60 days')
    t.ok(res.body.attributes.active_membership_duration < sixty_days + 10, 'duration should be approximately 60 days')
    t.end();
  });

  t.end();
});

test('get_account_info_payload - membership tenure attributes', async (t) => {
  const one_year_in_seconds = 360 * 24 * 60 * 60
  const thirty_days_in_seconds = 60 * 60 * 24 * 30

  t.test('new account returns duration and member_for_more_than_one_year false', async (t) => {
    const account = {
      pubkey: 'abc123',
      created_at: current_time() - thirty_days_in_seconds,
      expiry: current_time() + thirty_days_in_seconds,
      transactions: [{
        type: 'iap',
        id: '1',
        start_date: current_time() - thirty_days_in_seconds,
        end_date: current_time() + thirty_days_in_seconds,
        purchased_date: current_time() - thirty_days_in_seconds,
        duration: null
      }]
    }
    const payload = get_account_info_payload(1, account)
    t.equal(payload.attributes.member_for_more_than_one_year, false)
    t.ok(payload.attributes.active_membership_duration > 0, 'duration should be positive for active account')
    t.ok(payload.attributes.active_membership_duration < one_year_in_seconds, 'duration should be less than one year')
    t.end()
  })

  t.test('account with > 3 years returns correct duration', async (t) => {
    const total_duration = 3 * one_year_in_seconds + 1
    const account = {
      pubkey: 'abc123',
      created_at: current_time() - total_duration,
      expiry: current_time() + thirty_days_in_seconds,
      transactions: [{
        type: 'iap',
        id: '1',
        start_date: current_time() - total_duration,
        end_date: current_time(),
        purchased_date: current_time() - total_duration,
        duration: null
      }]
    }
    const payload = get_account_info_payload(1, account)
    t.equal(payload.attributes.member_for_more_than_one_year, true)
    t.ok(payload.attributes.active_membership_duration > 3 * one_year_in_seconds, 'duration should exceed three years')
    t.end()
  })

  t.test('account with > 1 year but < 3 years returns correct duration', async (t) => {
    const total_duration = one_year_in_seconds + 1
    const account = {
      pubkey: 'abc123',
      created_at: current_time() - total_duration,
      expiry: current_time() + thirty_days_in_seconds,
      transactions: [{
        type: 'iap',
        id: '1',
        start_date: current_time() - total_duration,
        end_date: current_time(),
        purchased_date: current_time() - total_duration,
        duration: null
      }]
    }
    const payload = get_account_info_payload(1, account)
    t.equal(payload.attributes.member_for_more_than_one_year, true)
    t.ok(payload.attributes.active_membership_duration > one_year_in_seconds)
    t.ok(payload.attributes.active_membership_duration < 3 * one_year_in_seconds)
    t.end()
  })

  t.test('inactive account returns zero duration', async (t) => {
    const total_duration = 3 * one_year_in_seconds + 1
    const account = {
      pubkey: 'abc123',
      created_at: current_time() - total_duration,
      expiry: current_time() - 1, // expired
      transactions: [{
        type: 'iap',
        id: '1',
        start_date: current_time() - total_duration,
        end_date: current_time() - 1,
        purchased_date: current_time() - total_duration,
        duration: null
      }]
    }
    const payload = get_account_info_payload(1, account)
    t.equal(payload.active, false)
    t.equal(payload.attributes.member_for_more_than_one_year, false)
    t.equal(payload.attributes.active_membership_duration, 0)
    t.end()
  })

  t.end()
});
