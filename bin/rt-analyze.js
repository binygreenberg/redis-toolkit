#!/usr/bin/env node
const redis = require('redis');
const cliProgress = require('cli-progress');
const program = require('commander');
const { table } = require('table');
const chalk = require('chalk');

function toRegex(values) {
  return values.split(' ').map((value) => new RegExp(value));
}

function toInt(value) {
  return parseInt(value, 10);
}

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .requiredOption('-s, --sample-size <number>', 'sample size', toInt)
  .option('--patterns <value>', 'list of key patterns to analyze', toRegex)
  .option('-b, --batch-size <number>', 'batch size', 100)
  .parse(process.argv);

// init module variables
const opts = program.opts();
const numOfBatches = Math.floor(opts.sampleSize / opts.batchSize);
let totalKeysSize = 0;
const aggregatedResults = {};

console.log(opts);
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

async function runBatch() {
  await redisClient.connect();
  const multi = redisClient.multi();
  for (let i = 0; i < opts.batchSize; i += 1) {
    multi.addCommand(['RANDOMKEY']);
  }
  const repliesKeys = await multi.exec();
  const multiMemorySize = redisClient.multi();
  repliesKeys.map((reply) => multiMemorySize.addCommand(['MEMORY', 'USAGE', reply]));
  const repliesMemory = await multiMemorySize.exec();

  repliesMemory.forEach((replyMemory, index) => {
    const key = repliesKeys[index];
    let regexKey;
    if (!opts.patterns) {
      regexKey = key.split(':')[0];
    } else {
      regexKey = opts.patterns.find((regex) => regex.test(key));
    }
    regexKey = regexKey || 'other keys';
    aggregatedResults[regexKey] = aggregatedResults[regexKey] || { count: 0, size: 0 };
    aggregatedResults[regexKey].count += 1;
    aggregatedResults[regexKey].size += replyMemory;
    totalKeysSize += replyMemory;
  });
  await redisClient.quit();
}

async function run() {
  const progressBar = new cliProgress.Bar();
  progressBar.start(numOfBatches, 0);
  let batchCount = 0;
  while (batchCount < numOfBatches) {
    await runBatch();
    batchCount += 1;
    progressBar.update(batchCount);
  }
}

function transformResultsToTable() {
  const totalKeys = numOfBatches * opts.batchSize;
  const headers = ['Key', 'Count', '% of DB', 'Size in Bytes', '% of DB', 'Mean Size'].map((value) => chalk.bold(value));
  const tableData = [headers];
  Object.keys(aggregatedResults).forEach((result) => {
    const row = [];
    row[0] = chalk.green(result);
    row[1] = aggregatedResults[result].count;
    row[2] = ((aggregatedResults[result].count / totalKeys) * 100).toFixed(2);
    row[3] = aggregatedResults[result].size;
    row[4] = ((aggregatedResults[result].size / totalKeysSize) * 100).toFixed(2);
    row[5] = (aggregatedResults[result].size / aggregatedResults[result].count).toFixed(2);
    tableData.push(row);
  });
  return table(tableData);
}

run().then(() => {
  console.log();
  console.log(transformResultsToTable());
  process.exit();
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
