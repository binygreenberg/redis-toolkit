#!/usr/bin/env node
const redis = require('redis');
const { promisify } = require('util');
const cliProgress = require('cli-progress');
const program = require('commander');
const { table } = require('table');
const chalk = require('chalk');

function toRegex(values) {
  return values.split(' ').map((value) => new RegExp(value));
}
program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379).option('-a, --auth <value>', 'redis auth', 'default')
  .requiredOption('-s, --sample-size <number>', 'sample size', parseInt)
  .option('--patterns <value>', 'list of key patterns to analyze', toRegex)
  .option('-b, --batch-size <number>', 'batch size', 100)
  .parse(process.argv);

// init module variables
const numOfBatches = Math.floor(program.sampleSize / program.batchSize);
let totalKeysSize = 0;
const aggregatedResults = {};
const redisClient = redis.createClient(
  {
    host: program.host,
    port: program.port,
    password: program.auth,
  },
);
redisClient.on('error', (err) => {
  console.log();
  console.error(err);
  process.exit(1);
});

async function runBatch() {
  const arrayRandomKey = new Array(program.batchSize).fill(['randomkey']);
  const batch = redisClient.batch(arrayRandomKey);
  const execPromiseRandomKey = promisify(batch.exec).bind(batch);
  const repliesKeys = await execPromiseRandomKey();

  const memoryKeys = repliesKeys.map((reply) => ['memory', 'USAGE', reply]);
  const batchMemory = redisClient.batch(memoryKeys);
  const execPromiseMemory = promisify(batch.exec).bind(batchMemory);
  const repliesMemory = await execPromiseMemory();

  repliesMemory.forEach((replyMemory, index) => {
    const key = repliesKeys[index];
    let regexKey;
    if (!program.patterns) {
      regexKey = key.split(':')[0];
    } else {
      regexKey = program.patterns.find((regex) => regex.test(key));
    }
    regexKey = regexKey || 'other keys';
    aggregatedResults[regexKey] = aggregatedResults[regexKey] || { count: 0, size: 0 };
    aggregatedResults[regexKey].count += 1;
    aggregatedResults[regexKey].size += replyMemory;
    totalKeysSize += replyMemory;
  });
}

async function run() {
  const progressBar = new cliProgress.Bar();
  progressBar.start(numOfBatches, 0);
  let batchCount = 0;
  while (batchCount < numOfBatches) {
    await runBatch();
    batchCount++;
    progressBar.update(batchCount);
  }
}

function transformResultsToTable() {
  const totalKeys = numOfBatches * program.batchSize;
  const headers = ['Key', 'Count', '% of DB', 'Size in Bytes', '% of DB', 'Mean Size'].map((value) => chalk.bold(value));
  const tableData = [headers];
  Object.keys(aggregatedResults).forEach((result) => {
    const row = [];
    row[0] = result;
    row[1] = aggregatedResults[result].count;
    row[2] = (aggregatedResults[result].count / totalKeys * 100).toFixed(2);
    row[3] = aggregatedResults[result].size;
    row[4] = (aggregatedResults[result].size / totalKeysSize * 100).toFixed(2);
    row[5] = (aggregatedResults[result].size / aggregatedResults[result].count).toFixed(2);
    tableData.push(row);
  });
  return table(tableData);
}

run().then(() => {
  const table = transformResultsToTable(aggregatedResults);
  console.log();
  console.log(table);
  process.exit();
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
