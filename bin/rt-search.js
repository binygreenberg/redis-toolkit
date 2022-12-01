#!/usr/bin/env node
const redis = require('redis');
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

let countFound = 0;
const keysFound = [];

async function run() {
  await redisClient.connect();
  const dbSize = await redisClient.dbSize();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys found: {found}',
  });
  progressBar.start(dbSize, 0, { deleted: 0 });
  const scanOptions = {
    MATCH: opts.pattern,
    COUNT: opts.batchSize,
  };
  // An iteration starts when the cursor is set to "0", and terminates when the cursor returned by the server is "0".
  // eslint-disable-next-line no-restricted-syntax
  for await (const key of redisClient.scanIterator(scanOptions)) {
    keysFound.push(key);
    countFound += 1;
    progressBar.update(1, { found: countFound });
  }
  await redisClient.quit();
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
