const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const HTML = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
}).listen(PORT, () => {
  console.log(`Cafyz web app running at http://localhost:${PORT}`);
});
