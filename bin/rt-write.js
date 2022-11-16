#!/usr/bin/env node
const redis = require('redis');
const cliProgress = require('cli-progress');
const program = require('commander');
const { commandOptions } = require('redis');
// eslint-disable-next-line no-unused-vars
const { drawBorderBottom } = require('table/dist/drawBorder');

function toInt(value) {
  return parseInt(value, 10);
}

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .requiredOption('-s, --sample-size <number>', 'sample size', toInt)
  .requiredOption('--pattern <value>', 'pattern to search for')
  .option('-b, --batch-size <number>', 'batch size', 100)
  .option('-h2, --host2 <value>', 'redis host', 'localhost')
  .option('-p2, --port2 <number>', 'redis port', 6379)
  .parse(process.argv);

// init module variables
const opts = program.opts();
// console.log(opts);

const redisClient = redis.createClient(
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
  console.error('error1', err);
  process.exit(1);
});

const redisClient2 = redis.createClient(
  {
    socket: {
      host: opts.host2,
      port: opts.port2,
    },
  },
);

redisClient2.on('error', (err) => {
  console.log();
  console.error('error2', err);
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
  let cursor = '0';
  // An iteration starts when the cursor is set to "0", and terminates when the cursor returned by the server is "0".
  do {
    const reply = await redisClient.scan(cursor, scanOptions);
    // eslint-disable-next-line prefer-destructuring
    cursor = reply.cursor;
    const { keys } = reply;
    if (keys.length) {
      // eslint-disable-next-line guard-for-in,no-restricted-syntax
      const values = await Promise.all(keys.map((key) => redisClient.get(commandOptions({ returnBuffers: true }), key)));
      const promisesWrite = [];
      // eslint-disable-next-line no-loop-func
      values.forEach((value, i) => {
        if (value) {
          countFound += 1;
          const promise = redisClient2.set(keys[i], value);
          promisesWrite.push(promise);
        }
      });
      await Promise.all(promisesWrite);
    }
    progressBar.update(Math.min(opts.batchSize, dbSize), { found: countFound });
  } while (cursor !== '0' && countFound < opts.sampleSize);

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
