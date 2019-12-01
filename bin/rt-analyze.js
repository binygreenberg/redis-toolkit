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
  .option('-p, --port <number>', 'redis port', 6379)
  .requiredOption('-s, --sample-size <number>', 'sample size', parseInt)
  .option('-b, --batch-size <number>', 'batch size', 5)
  .requiredOption('-r, --regex-list <value>', 'regular expressions', toRegex)
  .parse(process.argv);

// init module variables
const numOfBatches = Math.floor(program.sampleSize / program.batchSize);
let totalKeysSize = 0;
const aggregatedResults = {};
const redisClient = redis.createClient(
  {
    host: program.host,
    port: program.port,
  }
);

async function runBatch() {
  const arrayRandomKey = new Array(program.batchSize).fill(['randomkey']);
  const batch = redisClient.batch(arrayRandomKey);
  const execPromiseRandomKey = promisify(batch.exec).bind(batch);
  const repliesKeys = await execPromiseRandomKey();

  const memoryKeys = repliesKeys.map((reply) => {
    return ["memory", 'USAGE', reply]
  });
  const batchMemory = redisClient.batch(memoryKeys);
  const execPromiseMemory = promisify(batch.exec).bind(batchMemory);
  const repliesMemory = await execPromiseMemory();

  repliesMemory.forEach((replyMemory, index) => {
    const key = repliesKeys[index];
    const regexKey = program.regexList.find((regex) => regex.test(key)) || 'other keys';
    aggregatedResults[regexKey] = aggregatedResults[regexKey] || { count: 0, size: 0 };
    aggregatedResults[regexKey].count += 1;
    aggregatedResults[regexKey].size += replyMemory;
    totalKeysSize += replyMemory;
  });
}

function sleep(ms){
  return new Promise(resolve=>{
    setTimeout(resolve,ms)
  })
}

async function run() {
  const progressBar = new cliProgress.Bar();
  progressBar.start(numOfBatches, 0);
  let batchCount = 0;
  while (batchCount < numOfBatches) {
    await runBatch();
    batchCount++;
    progressBar.update(batchCount);
    await sleep(100);
  }
}

function transformResultsToTable() {
  const totalKeys = numOfBatches * program.batchSize;
  const headers = ['Key', 'Count', '% of sample count', 'Size in Bytes', '% of sample size', 'Mean Size'].map((value)=>chalk.bold(value));
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
  return table(tableData)
}

run().then(() => {
  const table = transformResultsToTable(aggregatedResults);
  console.log();
  console.log(table);
  process.exit()
}).catch((err) => {
  console.error(err);
  process.exit(1);
});