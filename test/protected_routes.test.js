const test = require('tap').test;
const Router = require('../src/server_helpers.js').Router;
const nostr = require('nostr');
const { current_time, hash_sha256 } = require('../src/utils.js');

test('Router – Protected POST route should accept valid NIP-98 auth header (include payload)', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data({
            endpoint: '/test-good-auth',
            method: 'POST',
            authorized_method: 'POST',
            url: 'http://localhost:8989/test-good-auth',
        }, (data) => {
            t.same(data, 'OK', 'Response should match expected value');
            resolve();
        }, (status_code, headers) => {
            t.same(status_code, 200, 'Response should match expected value');
        });

        // Register a protected POST route for our successful test case
        router.post_authenticated('/test-good-auth', (req, res, capture_groups, auth_pubkey) => {
            t.same(auth_pubkey, test_data.good_pubkey, 'Auth pubkey should match test pubkey');
            t.same(req.body, test_data.good_body, 'Payload should match test payload');
            res.end('OK');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});

test('Router – Protected POST route should accept valid NIP-98 auth header (no payload)', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data({
            endpoint: '/test-good-auth',
            method: 'POST',
            authorized_method: 'POST',
            url: 'http://localhost:8989/test-good-auth',
            omit_body: true,
        }, (data) => {
            t.same(data, 'OK', 'Response should match expected value');
            resolve();
        }, (status_code, headers) => {
            t.same(status_code, 200, 'Response should match expected value');
        });

        // Register a protected POST route for our successful test case
        router.post_authenticated('/test-good-auth', (req, res, capture_groups, auth_pubkey) => {
            t.same(auth_pubkey, test_data.good_pubkey, 'Auth pubkey should match test pubkey');
            res.end('OK');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


test('Router – Protected POST route should not accept NIP-98 header with invalid signature', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                fake_sig: true  // Use a fake signature
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


test('Router – Protected POST route should not accept NIP-98 header with expired note', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-auth',
                expired_time: true  // Use an expired timestamp
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        // Register a protected POST route for our expired test case
        router.post_authenticated('/test-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


test('Router – Protected POST route should not accept NIP-98 header with incorrect URL', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                incorrect_url: true  // Use an incorrect URL
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


test('Router – Protected POST route should not accept NIP-98 header with incorrect METHOD', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'PUT',   // Simulate an incorrect method on the authorization header
                url: 'http://localhost:8989/test-bad-auth',
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


test('Router – Protected POST route should not accept NIP-98 header with incorrect SHA-256', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                fake_body: true  // Use a fake body
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


test('Router – Protected POST route should not accept empty NIP-98 header', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                empty_auth_header: true  // Use an empty Authorization header
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});

test('Router – Protected POST route should not accept NIP-98 header with bogus base64', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                bogus_base64: true  // Use a bogus base64 string
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


test('Router – Protected POST route should not accept no NIP-98 auth header', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                omit_auth_header: true  // Omit the Authorization header
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});

test('Router – Protected POST route should not accept if there is a payload but none is declared in the auth header', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                omit_payload_tag: true  // Omit the payload tag
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});

test('Router – Protected POST route should not accept if there is no payload one is declared in the auth header', async (t) => {
    const router = new Router("http://localhost:8989");

    return new Promise(async (resolve, reject) => {
        const test_data = await generate_test_data(
            {
                endpoint: '/test-bad-auth',
                method: 'POST',
                authorized_method: 'POST',
                url: 'http://localhost:8989/test-bad-auth',
                omit_body: true,  // Omit the body
                force_include_payload_tag: true  // Force include the payload tag
            },
            (data) => { },
            (status_code, headers) => {
                t.same(status_code, 401, 'Response should match expected value');
                resolve();
            }
        );

        router.post_authenticated('/test-bad-auth', (req, res, capture_groups, auth_pubkey) => {
            t.fail('Should not be called');
        });

        router.handle_request(test_data.auth_req, test_data.auth_res);
    });
});


async function generate_test_data(options, end_callback, writehead_callback) {
    let test_privkey = '10a9842fadc0aae2a649a1b707bf97e48c787b8517af4728ba3ec304089451be';
    let test_pubkey = nostr.getPublicKey(test_privkey)
    let villain_privkey = 'eb538cb990641cbde30e63601a18ceb63ed2a8da08b32d85ae1ae4941e163fec';

    let body = good_test_body();
    let fake_body = JSON.stringify({ foo: 'baz' });

    // Follows NIP-98
    const note_template = {
        pubkey: test_pubkey,
        created_at: options.expired_time ? current_time() - 61 : current_time(),
        kind: options.wrong_kind ? 1 : 27235,
        tags: [
            ["u", options.incorrect_url ? "http://localhost:8989/some-different-url" : options.url],
            ["method", options.authorized_method],
        ],
        content: '',
    }

    if((!options.omit_body || options.force_include_payload_tag) && !options.omit_payload_tag) {
        note_template.tags.push(["payload", options.fake_body ? hash_sha256(fake_body) : hash_sha256(body)]);
    }

    const note_id = await nostr.calculateId(note_template);
    const note_sig = await nostr.signId(options.fake_sig ? villain_privkey : test_privkey, note_id);

    const note = {
        ...note_template,
        id: note_id,
        sig: note_sig
    }
    const note_base64 = options.bogus_base64 ? "aaaaaaaaaaa" : Buffer.from(JSON.stringify(note)).toString('base64');

    const auth_req = generate_mock_request(
        options.endpoint,
        options.method,
        options.omit_body ? undefined : body,
        options.omit_auth_header ? 
            { 'Content-Type': 'application/json' }
            :
            options.empty_auth_header ? 
                {
                    'Content-Type': 'application/json',
                    'Authorization': `Nostr `
                }
            :
                {
                    'Content-Type': 'application/json',
                    'Authorization': `Nostr ${note_base64}`
                }
    );

    const auth_res = generate_mock_response(end_callback, writehead_callback);

    return {
        auth_req,
        auth_res,
        good_pubkey: test_pubkey,
        good_body: body,
    };
}

function good_test_body() {
    return JSON.stringify({ foo: 'bar' });
}

function generate_mock_request(url, method, body, headers) {
    if (headers["Authorization"]) {
        headers.authorization = headers["Authorization"];
        delete headers["Authorization"];
    }
    return {
        url,
        method,
        body,
        headers,
        on: (event, callback) => {
            if (event === 'data') {
                callback(body);
            }
            if (event === 'end') {
                callback();
            }
        }
    };
}

function generate_mock_response(end_callback, writehead_callback) {
    return {
        end: end_callback,
        writeHead: (statusCode, headers) => {
            // Ensure statusCode is a number
            if (typeof statusCode !== 'number') {
                throw new Error('Status code must be a number');
            }
            // Ensure headers is an object
            if (typeof headers !== 'object') {
                throw new Error('Headers must be an object');
            }
            writehead_callback(statusCode, headers);
        }
    };
}
