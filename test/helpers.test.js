const test = require('tap').test;
const Router = require('../src/server_helpers.js').Router;


test('Router - Registering Routes', (t) => {
  const router = new Router("http://localhost:8989");

  t.test('should register a GET route', (t) => {
    router.get('/users', (req, res) => {
      res.end('GET /users');
    });

    const route = router.routes.find((r) => r.method === 'GET' && r.path === '/users');
    t.ok(route, 'GET route should be registered');
    t.end();
  });

  t.test('should register a POST route', (t) => {
    router.post('/users', (req, res) => {
      res.end('POST /users');
    });

    const route = router.routes.find((r) => r.method === 'POST' && r.path === '/users');
    t.ok(route, 'POST route should be registered');
    t.end();
  });

  t.end();
});

test('Router - Handling Requests', (t) => {
  const router = new Router("http://localhost:8989");

  t.test('should handle a valid GET request', (t) => {
    router.get('/users/(.+)', (req, res, captureGroups) => {
      res.end(`GET /users/${captureGroups[0]}`);
    });

    const req = {
      url: '/users/123',
      method: 'GET',
      on: (event, callback) => {
        if (event === 'data') {
          callback({}); // Simulate a request body
        }
        if (event === 'end') {
          callback();
        }
      }

    };
    const res = {
      end: (data) => {
        t.equal(data, 'GET /users/123', 'Response should match expected value');
        t.end();
      },
      writeHead: () => {}
    };

    router.handle_request(req, res);
  });

  // Add tests for handling other HTTP methods and error cases here

  t.end();
});

test('Router - Matching Routes', (t) => {
  const router = new Router("http://localhost:8989");

  t.same(router.match_route('/users', '/users'), [], 'Route should be matched with no capture groups');
  t.same(router.match_route('/users/123', '/users/\\d+'), [], 'Route should be matched with no capture groups');
  t.same(router.match_route('/users/123', '/users/(.+)'), ["123"], 'Route should be matched with one capture group');
  t.same(router.match_route('/users/123', '/users'), false, 'Route should not be matched');
  t.same(router.match_route('/users/123', '/users/(.+)/(.+)'), false, 'Route should not be matched');
  t.same(router.match_route('/users/123/receipt/456', '/users/(.+)/receipt/(.+)'), ['123', '456'], 'Route should be matched with multiple capture groups');
  t.same(router.match_route('/users/123/receipt/456', '/users/(.+)/receipt'), false, 'Route should not be matched');
  t.same(router.match_route('/users/123/receipt/456', '/users/(.+)/receipt/(.+)/(.+)'), false, 'Route should not be matched');
  t.same(router.match_route('/users/123/receipt/abc', '/users/(.+)/receipt/(\d+)'), false, 'Route should not be matched');

  t.end();
});
