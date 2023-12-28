const test = require('tap').test;
const express = require('express');
const config_router = require('../src/router_config.js').config_router;
const nostr = require('nostr');
const current_time = require('../src/utils.js').current_time;
const { supertest_client } = require('./utils.js');

test('config_router - Account management routes', async (t) => {
  const account_info = {
    pubkey: 'abc123',
    created_at: Date.now() - 60 * 60 * 24 * 30 * 1000, // 30 days ago
    expiry: Date.now() + 60 * 60 * 24 * 30 * 1000 // 30 days
  };
  const accounts = {
    'abc123': account_info
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
        }
      }
    }
  };

  const request = await supertest_client(app.router, t);

  config_router(app);

  t.test('should handle a valid GET request for an existing account ', async (t) => {
    const res = await request
      .get('/accounts/abc123')
      .expect(200);

    const expectedData = {
      pubkey: account_info.pubkey,
      created_at: account_info.created_at,
      expiry: account_info.expiry,
      active: true,
    };
    t.same(res.body, expectedData, 'Response should match expected value');
    t.end();
  });

  t.test('should handle a valid POST request to create an account', async (t) => {
    let test_privkey = '10a9842fadc0aae2a649a1b707bf97e48c787b8517af4728ba3ec304089451be';
    let test_pubkey = nostr.getPublicKey(test_privkey);

    let auth_note_template = {
      pubkey: test_pubkey,
      created_at: current_time(),
      kind: 27235,
      tags: [
        ["u", app.router.base_url + "/accounts"],
        ["method", "POST"]
      ],
      content: '',
    }

    let auth_note_id = await nostr.calculateId(auth_note_template);
    let auth_note_sig = await nostr.signId(test_privkey, auth_note_id);
    let auth_note = {
      ...auth_note_template,
      id: auth_note_id,
      sig: auth_note_sig
    }
    let auth_note_base64 = Buffer.from(JSON.stringify(auth_note)).toString('base64');

    const res = await request
      .post('/accounts')
      .set('authorization', 'Nostr ' + auth_note_base64)
      .expect(200);

    t.equal(res.body.pubkey, test_pubkey, 'Pubkey should match requested value');
    t.equal(res.body.active, false, 'Account should be inactive before payment is made');
    t.equal(res.body.expiry, null, 'Account should not have an expiry before payment is made');
    t.end();
  });

  t.end();
});
