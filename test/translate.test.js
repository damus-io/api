const tap = require('tap');
const translate_payload = require('../src/translate');
const sinon = require('sinon');
const nostr = require('nostr');


// MARK: - Tests

tap.test('translate_payload - Existing translation in database (mocked db)', async (t) => {
    const api = generate_test_api({
        simulate_existing_translation_in_db: "<EXISTING_TRANSLATION>",
        simulate_account_found_in_db: true,
    });

    const res = {
        writeHead: () => { },
        end: (response) => {
            // Check JSON response
            t.same(response, '{\"text\":\"<EXISTING_TRANSLATION>\"}\n');
        },
    };
    const req = await generate_test_req();

    await translate_payload(api, req, res);

    t.end();
});

tap.test('translate_payload - New translation (mocked server)', async (t) => {
    const api = generate_test_api({
        simulate_existing_translation_in_db: false,
        simulate_account_found_in_db: true,
    });

    const res = {
        writeHead: () => { },
        end: (response) => {
            // Check JSON response
            t.same(response, '{\"text\":\"Mock translation\"}\n');
        },
    };
    const req = await generate_test_req();

    // Create a stub for fetch
    const fetchStub = sinon.stub(global, 'fetch').returns(Promise.resolve({
        json: async () => {
            return {
                translations: [
                    { text: 'Mock translation' }
                ]
            };
        }
    }));

    await translate_payload(api, req, res);

    // Restore fetch
    fetchStub.restore();

    t.end();
});


// MARK: - Helpers


function generate_test_api(config) {
    return {
        translation: {
            queue: {},
        },
        dbs: {
            translations: {
                get: (trans_id) => {
                    if (config.simulate_existing_translation_in_db) {
                        // Simulate existing translation in the database
                        return {
                            text: config.simulate_existing_translation_in_db,
                        };
                    } else {
                        // Simulate translation not found in the database
                        return null;
                    }
                },
                put: () => { },
            },
            accounts: {
                get: (id) => {
                    if (config.simulate_account_found_in_db) {
                        // Simulate account found in the database
                        return {
                            expiry: Date.now() + 60 * 60 * 24 * 30 * 1000 // 30 days
                        };
                    }
                    else if (config.simulate_account_expired) {
                        // Simulate account found in the database
                        return {
                            expiry: Date.now() - 60 * 60 * 24 * 30 * 1000 // 30 days ago
                        };
                    }
                    else {
                        // Simulate account not found in the database
                        return null;
                    }
                },
            },
        },
    };
}


async function generate_test_req() {
    const note = await generate_test_event();
    const req = {
        body: JSON.stringify(note),
    };
    return req;
}


async function generate_test_event(payload) {
    let sk = '10a9842fadc0aae2a649a1b707bf97e48c787b8517af4728ba3ec304089451be'
    let pk = nostr.getPublicKey(sk)

    let event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(payload || generate_translation_request_payload()),
        pubkey: pk,
    }

    event.id = await nostr.calculateId(event)
    event.sig = await nostr.signId(sk, event.id)

    return event
}

function generate_translation_request_payload() {

    let payload = {
        source: 'EN',
        target: 'JA',
        q: "Hello"
    }

    return payload
}
