#!/usr/bin/env node
const redis = require('redis');
const { promisify } = require('util');
const cliProgress = require('cli-progress');
const program = require('commander');

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .option('-a, --auth <value>', 'redis password')
  .option('-b, --batch-size <number>', 'batch size', 1000)
  .requiredOption('--pattern <value>', 'pattern to delete')
  .parse(process.argv);

// init module variables
const opts = program.opts();
const redisClient = redis.createClient(
  {
    host: opts.host,
    port: opts.port,
  },
);

redisClient.on('error', (err) => {
  console.log();
  console.error(err);
  process.exit(1);
});

const scanAsync = promisify(redisClient.scan).bind(redisClient);
const unlinkAsync = promisify(redisClient.unlink).bind(redisClient);
let countDeleted = 0;
const DBSIZEAsync = promisify(redisClient.DBSIZE).bind(redisClient);

async function run() {
  const dbSize = await DBSIZEAsync();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys deleted: {deleted}',
  });
  progressBar.start(dbSize, 0, { deleted: 0 });
  let cursor = '0';
  // An iteration starts when the cursor is set to "0", and terminates when the cursor returned by the server is "0".
  do {
    const reply = await scanAsync(cursor, 'MATCH', opts.pattern, 'COUNT', opts.batchSize);
    cursor = reply[0];
    const keys = reply[1];
    if (keys.length) {
      const deleteSuccess = await unlinkAsync(keys);
      if (deleteSuccess) {
        countDeleted += deleteSuccess;
      }
    }
    progressBar.update(Math.min(opts.batchSize, dbSize), { deleted: countDeleted });
  } while (cursor !== '0');
}

run().then(() => {
  console.log();
  if (!countDeleted) {
    console.log(`no keys matching pattern "${opts.pattern}" found`);
  } else {
    console.log(`successfully deleted ${countDeleted} keys matching pattern "${opts.pattern}"`);
  }
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit(1);
});
