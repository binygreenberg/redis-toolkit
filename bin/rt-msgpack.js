#!/usr/bin/env node
const { createClient, commandOptions } = require('redis');
const cliProgress = require('cli-progress');
const program = require('commander');
const msgpack = require('msgpack');

function toInt(value) {
  return parseInt(value, 10);
}
console.log('hi!');

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .option('--pattern <value>', 'pattern to search for', '*')
  .option('-b, --batch-size <number>', 'batch size', 100)
  .option('-h2, --host2 <value>', 'redis host', 'localhost')
  .option('-p2, --port2 <number>', 'redis port', 6379)
  .parse(process.argv);

// init module variables
const opts = program.opts();
console.log(opts);

const redisClient = createClient(
  {
    socket: {
      host: opts.host,
      port: opts.port,
    },
    return_buffers: true,
  },
);

redisClient.on('error', (err) => {
  console.log();
  console.error(err);
  process.exit(1);
});

const redisClient2 = createClient(
  {
    socket: {
      host: opts.host2,
      port: opts.port2,
    },
  },
);

redisClient2.on('error', (err) => {
  console.log();
  console.error(err);
  process.exit(1);
});

let countFound = 0;
async function run() {
  await redisClient.connect();
  await redisClient2.connect();
  const dbSize = await redisClient.dbSize();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys found: {found}',
  });
  progressBar.start(dbSize, 0, { found: 0 });
  const scanOptions = {
    TYPE: 'string', // `SCAN` only
    MATCH: opts.pattern,
    COUNT: opts.batchSize,
  };
  // eslint-disable-next-line no-restricted-syntax
  for await (const key of redisClient.scanIterator(scanOptions)) {
    countFound += 1;
    const value = await redisClient.get(commandOptions({ returnBuffers: true }), key);
    const valPacked = msgpack.unpack(value);
    const arrayValue = valPacked.split('.').map((a) => toInt(a));
    const saveValue = msgpack.pack(arrayValue);
    redisClient2.set(key, saveValue);
    progressBar.update(1, { found: countFound });
  }
  await redisClient.quit();
  await redisClient2.quit();
}

run().then(() => {
  console.log();
  console.log(`Done with ${countFound}`);
  process.exit();
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
