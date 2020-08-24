#!/usr/bin/env node
const redis = require('redis');
const { promisify } = require('util');
const cliProgress = require('cli-progress');
const program = require('commander');

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .option('-b, --batch-size <number>', 'batch size', 1000)
  .requiredOption('-p, --pattern <value>', 'pattern to search for')
  .parse(process.argv);

// init module variables
const redisClient = redis.createClient(
  {
    host: program.host,
    port: program.port,
  }
);
redisClient.on("error", function(err) {
  console.log();
  console.error(err);
  process.exit(1);
});
const scanAsync = promisify(redisClient.scan).bind(redisClient);
const DBSIZEAsync = promisify(redisClient.DBSIZE).bind(redisClient);
let countFound = 0;
const keysFound = [];

async function run() {
  const dbSize = await DBSIZEAsync();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys found: {found}'
  });
  progressBar.start(dbSize, 0);
  let cursor = 0;
  // An iteration starts when the cursor is set to 0, and terminates when the cursor returned by the server is "0".
  while (cursor !== '0') {
    const reply = await scanAsync(cursor, 'MATCH', program.pattern, 'COUNT', program.batchSize);
    cursor = reply[0];
    const keys = reply[1];
    if (keys.length) {
      countFound += keys.length
      keysFound.push(keys);
    }
    progressBar.increment(program.batchSize);
    progressBar.update(null, { found: countFound })
  }
}

run().then(() => {
  console.log();
  if (!countFound) {
    console.log(`no keys matching pattern "${program.pattern}" found`);
  } else {
    console.log(`successfully found ${countFound} keys matching pattern "${program.pattern}"`);
    console.log(`keys: ${keysFound}`);
  }
  process.exit();
}).catch(err => {
  console.log(err);
  process.exit(1);
});
