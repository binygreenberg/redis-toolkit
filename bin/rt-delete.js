#!/usr/bin/env node
const redis = require('redis');
const cliProgress = require('cli-progress');
const program = require('commander');

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .option('-b, --batch-size <number>', 'batch size', 1000)
  .requiredOption('--pattern <value>', 'pattern to delete')
  .parse(process.argv);

// init module variables
const opts = program.opts();
const redisClient = redis.createClient(
  {
    socket: {
      host: opts.host,
      port: opts.port,
    },
  },
);

redisClient.on('error', (err) => {
  console.log();
  console.error(err);
  process.exit(1);
});

// const scanAsync = promisify(redisClient.scan).bind(redisClient);
// const unlinkAsync = promisify(redisClient.unlink).bind(redisClient);
let countDeleted = 0;

async function run() {
  await redisClient.connect();
  const dbSize = await redisClient.dbSize();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys deleted: {deleted}',
  });
  progressBar.start(dbSize, 0, { deleted: 0 });
  const scanOptions = {
    MATCH: opts.pattern,
    COUNT: opts.batchSize,
  };
  // eslint-disable-next-line no-restricted-syntax
  for await (const key of redisClient.scanIterator(scanOptions)) {
    const deleteSuccess = await redisClient.unlink(key);
    if (deleteSuccess) {
      countDeleted += deleteSuccess;
    }
    progressBar.update(deleteSuccess, { deleted: countDeleted });
  }
  await redisClient.quit();
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
