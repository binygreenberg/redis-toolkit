#!/usr/bin/env node
const redis = require('redis');
const { promisify } = require('util');
const cliProgress = require('cli-progress');
const program = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

program
  .option('-h, --host <value>', 'redis host', 'localhost')
  .option('-p, --port <number>', 'redis port', 6379)
  .option('-b, --batch-size <number>', 'batch size', 1000)
  .requiredOption('--pattern <value>', 'pattern to search for')
  .option('-f, --file <path>', 'save list to file')
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
const DBSIZEAsync = promisify(redisClient.DBSIZE).bind(redisClient);
let countFound = 0;
const keysFound = [];

async function run() {
  const dbSize = await DBSIZEAsync();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys found: {found}',
  });
  progressBar.start(dbSize, 0, { found: 0 });
  let cursor = '0';
  // An iteration starts when the cursor is set to "0", and terminates when the cursor returned by the server is "0".
  do {
    const reply = await scanAsync(cursor, 'MATCH', opts.pattern, 'COUNT', opts.batchSize);
    cursor = reply[0];
    const keys = reply[1];
    if (keys.length) {
      countFound += keys.length;
      keysFound.push(...keys);
    }
    progressBar.update(Math.min(opts.batchSize, dbSize), { found: countFound });
  } while (cursor !== '0');
  keysFound.sort();
}

run().then(() => {
  console.log();
  if (!countFound) {
    console.log(`no keys matching pattern "${opts.pattern}" found`);
  } else {
    console.log(`successfully found ${countFound} keys matching pattern "${opts.pattern}"\n`);
    console.log('keys:\n');
    console.log(keysFound.join('\n'));
    if (opts.file) {
      const fn = path.resolve('./', opts.file);
      fs.writeFileSync(fn, keysFound.join('\n'));
      console.log(chalk.yellow(`\nkeys list saved to "${fn}"`));
    }
  }
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit(1);
});
