import http from 'node:http';
import fs from 'node:fs';
import { Command } from 'commander';

const program = new Command();
program
  .helpOption('--help', 'показати довідку')
  .requiredOption('-i, --input <path>', 'шлях до файлу даних')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'файл для запису останньої відповіді');

program.parse();
const { input, host, port: portText, output } = program.opts();

if (!/^\d+$/.test(portText) || Number(portText) > 65535) {
  console.error('Error: port must be an integer from 0 to 65535');
  process.exit(1);
}
const port = Number(portText);

function reply(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

fs.access(input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/') {
      return reply(res, 404, { error: 'Маршрут не знайдено.' });
    }
    reply(res, 200, []);
  });

  server.on('error', (e) => {
    console.error(`Server error: ${e.message}`);
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}/`);
  });
});