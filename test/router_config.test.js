const test = require('tap').test;
const Router = require('../src/server_helpers.js').Router;
const config_router = require('../src/router_config.js').config_router;

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
    router: new Router(),
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

  t.test('should handle a valid POST request to create an account', (t) => {
    const req = {
      url: '/accounts',
      method: 'POST',
      on: (event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify({ pubkey: 'abc456' }))
        }
        if (event === 'end') {
          callback();
        }
      }
    };
    const res = {
      end: (data) => {
        data = JSON.parse(data)
        t.equal(data.pubkey, 'abc456', 'Pubkey should match requested value');
        t.equal(data.active, false, 'Account should be inactive before payment is made');
        t.equal(data.expiry, null, 'Account should not have an expiry before payment is made');
        t.end();
      },
      writeHead: () => { }
    };

    app.router.handle_request(req, res);
  });

  t.end();
});