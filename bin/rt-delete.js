#!/usr/bin/env node
const redis = require('redis');
const { promisify } = require('util');
const cliProgress = require('cli-progress');
const program = require('commander');

function toRegex(values) {
  return values.split(' ').map((value) => new RegExp(value));
}

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .option('-b, --batch-size <number>', 'batch size', 100)
  .requiredOption('-r, --regex-list <value>', 'regular expression to delete', toRegex)
  .parse(process.argv);

// init module variables
const redisClient = redis.createClient(
  {
    host: program.host,
    port: program.port,
  }
);
const scanAsync = promisify(redisClient.scan).bind(redisClient);
const unlinkAsync = promisify(redisClient.unlink).bind(redisClient);

async function run(cursor, pattern) {
  console.log('scan round', ++round);
  const reply = await scanAsync(cursor, 'MATCH', pattern, 'COUNT', program.batchSize);
  cursor = reply[0];
  const keys = reply[1];
  if (keys.length) {
    const deleteSuccess = await unlinkAsync(keys);
    if (deleteSuccess) {
      countDeleted += deleteSuccess;
      console.log(`successfully deleted ${deleteSuccess} keys`);
    }
  }
  if (cursor !== '0') return scan(cursor, pattern);
}

run(cursor, pattern).then(() => {
    console.log(`successfully deleted total ${countDeleted} keys`);
    process.exit();
  }).catch(err => {
    console.log(err);
    process.exit(1);
  });