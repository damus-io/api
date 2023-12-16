const test = require('tap').test;
const Router = require('../src/server_helpers.js').Router;
const config_router = require('../src/router_config.js').config_router;
const nostr = require('nostr');
const current_time = require('../src/utils.js').current_time;

test('config_router - Translation routes', (t) => {
  const app = {
    router: new Router(),
    dbs: {
      accounts: {
        get: () => { }
      }
    }
  };

  config_router(app);

  const route = app.router.find_route('/translate', 'GET')

  t.ok(route, 'GET /translate route should be registered');
  t.end();
});

test('config_router - Account management routes', (t) => {
  const account_info = {
    pubkey: 'abc123',
    created_at: Date.now() - 60 * 60 * 24 * 30 * 1000, // 30 days ago
    expiry: Date.now() + 60 * 60 * 24 * 30 * 1000 // 30 days
  };
  const accounts = {
    'abc123': account_info
  }

  const app = {
    router: new Router('http://localhost:8989'),
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

  config_router(app);

  t.test('should handle a valid GET request for an existing account ', (t) => {
    const req = {
      url: '/accounts/abc123',
      method: 'GET',
      on: (event, callback) => {
        if (event === 'end') {
          callback();
        }
      }
    };
    const res = {
      end: (data) => {
        const expectedData = JSON.stringify({
          pubkey: account_info.pubkey,
          created_at: account_info.created_at,
          expiry: account_info.expiry,
          active: true,
        }) + '\n';
        t.same(data, expectedData, 'Response should match expected value');
        t.end();
      },
      writeHead: () => { }
    };

    app.router.handle_request(req, res);
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

    return new Promise((resolve, reject) => {
      const req = {
        url: '/accounts',
        headers: {
          'authorization': 'Nostr ' + auth_note_base64
        },
        method: 'POST',
        on: (event, callback) => {
          if (event === 'data') {
            // No data
          }
          if (event === 'end') {
            callback();
          }
        }
      };
      const res = {
        end: (data) => {
          data = JSON.parse(data)
          t.equal(data.pubkey, test_pubkey, 'Pubkey should match requested value');
          t.equal(data.active, false, 'Account should be inactive before payment is made');
          t.equal(data.expiry, null, 'Account should not have an expiry before payment is made');
          resolve();
        },
        writeHead: () => { }
      };
      
      app.router.handle_request(req, res);
    });
  });

  t.end();
});