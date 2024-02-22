const test = require('tap').test;
const express = require('express');
const nostr = require('nostr');
const { current_time, hash_sha256 } = require('../src/utils.js');
const { capture_raw_body, required_nip98_auth } = require('../src/nip98_auth.js');
const bodyParser = require('body-parser');
const { supertest_client } = require('./controllers/utils.js');

test('Router – Protected POST route should accept valid NIP-98 auth header (include payload)', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-good-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: app.base_url + '/test-good-auth',
  });

  app.post('/test-good-auth', required_nip98_auth, (req, res) => {
    t.same(req.authorized_pubkey, test_data.good_pubkey, 'Auth pubkey should match test pubkey');
    t.same(req.body, test_data.good_body, 'Payload should match test payload');
    res.end('OK');
  });

  const response = await request
    .post('/test-good-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`)
    .send(test_data.good_body);

  t.same(response.status, 200, 'Response should match expected value');
  t.same(response.text, 'OK', 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should accept valid NIP-98 auth header (no payload)', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-good-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: app.base_url + '/test-good-auth',
    omit_body: true,
  });

  app.post('/test-good-auth', required_nip98_auth, (req, res) => {
    t.same(req.authorized_pubkey, test_data.good_pubkey, 'Auth pubkey should match test pubkey');
    res.end('OK');
  });

  const response = await request
    .post('/test-good-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`);

  t.same(response.status, 200, 'Response should match expected value');
  t.same(response.text, 'OK', 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept NIP-98 header with invalid signature', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-bad-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: app.base_url + '/test-bad-auth',
    fake_sig: true,
  });

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept NIP-98 header with expired note', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: app.base_url + '/test-auth',
    expired_time: true,
  });

  app.post('/test-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept NIP-98 header with incorrect URL', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-bad-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: 'http://127.0.0.1/test-bad-auth',
    incorrect_url: true,
  });

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept NIP-98 header with incorrect METHOD', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-bad-auth',
    method: 'POST',
    authorized_method: 'PUT',
    url: 'http://127.0.0.1/test-bad-auth',
  });

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept NIP-98 header with incorrect SHA-256', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-bad-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: 'http://127.0.0.1/test-bad-auth',
    fake_body: true,
  });

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`)
    .send(test_data.fake_body);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept empty NIP-98 header', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr `);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept NIP-98 header with bogus base64', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-bad-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: 'http://127.0.0.1/test-bad-auth',
    bogus_base64: true,
  });

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept no NIP-98 auth header', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth');

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept if there is a payload but none is declared in the auth header', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-bad-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: 'http://127.0.0.1/test-bad-auth',
    omit_payload_tag: true,
  });

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`)
    .send(test_data.good_body);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

test('Router – Protected POST route should not accept if there is no payload but one is declared in the auth header', async (t) => {
  const app = express();
  app.use(bodyParser.json({ verify: capture_raw_body }));
  const request = await supertest_client(app, t);

  const test_data = await generate_test_data({
    endpoint: '/test-bad-auth',
    method: 'POST',
    authorized_method: 'POST',
    url: 'http://127.0.0.1/test-bad-auth',
    omit_body: true,
    force_include_payload_tag: true,
  });

  app.post('/test-bad-auth', required_nip98_auth, (req, res) => {
    t.fail('Should not be called');
  });

  const response = await request
    .post('/test-bad-auth')
    .set('Authorization', `Nostr ${test_data.note_base64}`);

  t.same(response.status, 401, 'Response should match expected value');
  t.end();
});

async function generate_test_data(options) {
  let test_privkey = '10a9842fadc0aae2a649a1b707bf97e48c787b8517af4728ba3ec304089451be';
  let test_pubkey = nostr.getPublicKey(test_privkey);
  let villain_privkey = 'eb538cb990641cbde30e63601a18ceb63ed2a8da08b32d85ae1ae4941e163fec';

  let body = good_test_body();
  let fake_body = { foo: 'baz' };

  // Follows NIP-98
  const note_template = {
    pubkey: test_pubkey,
    created_at: options.expired_time ? current_time() - 61 : current_time(),
    kind: options.wrong_kind ? 1 : 27235,
    tags: [
      ["u", options.incorrect_url ? "http://127.0.0.1/some-different-url" : options.url],
      ["method", options.authorized_method],
    ],
    content: '',
  }

  if ((!options.omit_body || options.force_include_payload_tag) && !options.omit_payload_tag) {
    note_template.tags.push(["payload", options.fake_body ? hash_sha256(JSON.stringify(fake_body)) : hash_sha256(JSON.stringify(body))]);
  }

  const note_id = await nostr.calculateId(note_template);
  const note_sig = await nostr.signId(options.fake_sig ? villain_privkey : test_privkey, note_id);

  const note = {
    ...note_template,
    id: note_id,
    sig: note_sig
  }
  const note_base64 = options.bogus_base64 ? "aaaaaaaaaaa" : Buffer.from(JSON.stringify(note)).toString('base64');

  return {
    note_base64,
    good_pubkey: test_pubkey,
    good_body: body,
  };
}

function good_test_body() {
  return { foo: 'bar' };
}
