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

fs.access(input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  console.log(`Параметри в порядку: ${input}, ${host}:${port}, output=${output}`);
});