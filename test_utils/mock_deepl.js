const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ 
    translations: [
        { text: 'Mock translation' }
    ]
   }));
});

const port = 8990;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
