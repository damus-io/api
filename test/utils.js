const supertest = require('supertest');

async function create_http_server(app, t) {
  return new Promise((resolve, reject) => {
    const random_port = Math.floor(Math.random() * 10000) + 10000;
    const http_server = app.listen(random_port, () => {
      app.port = random_port;
      app.base_url = 'http://127.0.0.1:' + random_port;
      resolve(http_server);
    });

    // Close server after test is done
    t.teardown(() => {
      http_server.close();
    });
  });
}

async function supertest_client(app, t) {
  const http_server = await create_http_server(app, t);
  return supertest(http_server);
}

module.exports = {
  supertest_client
}
