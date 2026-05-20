const tap = require('tap');
const sinon = require('sinon');

const NOSWHERE_TRANSLATOR_PATH = require.resolve('../src/translate/noswhere.js');

function loadNoswhereTranslator() {
  delete require.cache[NOSWHERE_TRANSLATOR_PATH];
  return require(NOSWHERE_TRANSLATOR_PATH);
}

function mockHeaders(requestId) {
  return {
    get: (name) => name === 'x-noswhere-request' ? requestId : null,
  };
}

tap.test('NoswhereTranslator constructor logs malformed langs responses without crashing', async (t) => {
  process.env.NOSWHERE_KEY = 'test-key';

  const fetchStub = sinon.stub(global, 'fetch').resolves({
    ok: true,
    status: 200,
    headers: mockHeaders('langs-req-1'),
    text: async () => '',
  });
  const errorStub = sinon.stub(console, 'error');

  t.teardown(() => {
    fetchStub.restore();
    errorStub.restore();
    delete process.env.NOSWHERE_KEY;
    delete require.cache[NOSWHERE_TRANSLATOR_PATH];
  });

  const NoswhereTranslator = loadNoswhereTranslator();
  const translator = new NoswhereTranslator();

  await new Promise((resolve) => setImmediate(resolve));

  t.equal(translator.canTranslate('en', 'ja'), true, 'translator stays usable when langs cannot be loaded');
  t.ok(errorStub.calledTwice, 'malformed response is logged without escaping the constructor');
  t.match(errorStub.firstCall.args[0], /noswhere %s response parse error/, 'parse failure is logged');
  t.match(errorStub.firstCall.args.slice(1).join(' '), /langs-req-1/, 'request id is included in log output');
  t.match(errorStub.firstCall.args.slice(1).join(' '), /<empty>/, 'response body snippet is included in log output');
  t.match(errorStub.secondCall.args[0], /error loading noswhere translation langs/, 'constructor catch logs the failure summary');
});

tap.test('NoswhereTranslator translate rejects malformed JSON responses with request details', async (t) => {
  process.env.NOSWHERE_KEY = 'test-key';

  const fetchStub = sinon.stub(global, 'fetch');
  fetchStub.onFirstCall().resolves({
    ok: true,
    status: 200,
    headers: mockHeaders('langs-req-2'),
    text: async () => JSON.stringify({
      default: {
        from: ['en'],
        to: ['ja'],
      },
    }),
  });
  fetchStub.onSecondCall().resolves({
    ok: true,
    status: 200,
    headers: mockHeaders('translate-req-1'),
    text: async () => '{"result"',
  });
  const errorStub = sinon.stub(console, 'error');

  t.teardown(() => {
    fetchStub.restore();
    errorStub.restore();
    delete process.env.NOSWHERE_KEY;
    delete require.cache[NOSWHERE_TRANSLATOR_PATH];
  });

  const NoswhereTranslator = loadNoswhereTranslator();
  const translator = new NoswhereTranslator();

  await new Promise((resolve) => setImmediate(resolve));

  await t.rejects(
    translator.translate('en', 'ja', 'hello'),
    /error translating: invalid JSON response from Noswhere \(request: translate-req-1\)/,
    'translate surfaces a helpful parse error'
  );
  t.equal(errorStub.calledOnce, true, 'translate parse failures are logged');
  t.match(errorStub.firstCall.args.slice(1).join(' '), /translate-req-1/, 'translate log includes request id');
  t.match(errorStub.firstCall.args.slice(1).join(' '), /{"result"/, 'translate log includes body snippet');
});
