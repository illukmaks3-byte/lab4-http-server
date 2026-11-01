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


function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}


function parseNdjson(text) {
  const records = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === '') continue;
    const record = JSON.parse(line); 
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw new Error('рядок не є JSON-об\'єктом');
    }
    records.push(record);
  }
  return records;
}


function buildResult(records, params) {
  const showCyl = params.get('cylinders') === 'true';
  const hasLimit = params.has('max_mpg');
  let limit = null;
  if (hasLimit) {
    limit = toNumber(params.get('max_mpg'));
    if (limit === null) return { status: 400, payload: { error: 'Параметр max_mpg має бути числом.' } };
  }

  const result = [];
  for (const rec of records) {
    const mpg = toNumber(rec.mpg);
    if (hasLimit && (mpg === null || !(mpg < limit))) continue; 
    const item = { model: rec.model ?? null };
    if (showCyl) item.cyl = toNumber(rec.cyl);
    item.mpg = mpg;
    result.push(item);
  }
  return { status: 200, payload: result };
}


function reply(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}


function respond(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  if (!output) return reply(res, status, body);
  fs.writeFile(output, body, 'utf8', (err) => {
    if (err) {
      console.error(`Помилка запису у "${output}": ${err.code}`);
      const errBody = JSON.stringify({ error: 'Не вдалося записати відповідь у файл.' }, null, 2);
      return reply(res, 500, errBody);
    }
    reply(res, status, body);
  });
}


function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/') {
    return respond(res, 404, { error: 'Маршрут не знайдено.' });
  }
  const params = url.searchParams;

  fs.readFile(input, 'utf8', (err, text) => {
    try {
      if (err) {
        return respond(res, 500, { error: 'Не вдалося прочитати файл даних.' });
      }
      let records;
      try {
        records = parseNdjson(text);
      } catch (parseErr) {
        return respond(res, 500, { error: 'Файл даних пошкоджено: некоректний NDJSON.' });
      }
      const { status, payload } = buildResult(records, params);
      respond(res, status, payload);
    } catch (e) {
      console.error(e);
      respond(res, 500, { error: 'Внутрішня помилка сервера.' });
    }
  });
}

fs.access(input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    try {
      handleRequest(req, res);
    } catch (e) {
      console.error(e);
      respond(res, 500, { error: 'Внутрішня помилка сервера.' });
    }
  });

  server.on('error', (e) => {
    console.error(`Server error: ${e.message}`);
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}/`);
  });
});