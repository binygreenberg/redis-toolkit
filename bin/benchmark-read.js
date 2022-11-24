#!/usr/bin/env node
/* eslint-disable no-unused-vars */
const redis = require('redis');
const cliProgress = require('cli-progress');
const { commandOptions } = require('redis');
const msgpack = require('msgpack');

const redisClientOriginal = redis.createClient(
  {
    socket: {
      host: 'localhost',
      port: 7770,
    },
    return_buffers: true,
  },
);

const redisClientMsgPack = redis.createClient(
  {
    socket: {
      host: 'localhost',
      port: 7777,
    },
    return_buffers: true,
  },
);

const redisClientSet = redis.createClient(
  {
    socket: {
      host: 'localhost',
      port: 7778,
    },
  },
);

const redisClientSetPacked = redis.createClient(
  {
    socket: {
      host: 'localhost',
      port: 7779,
    },
    return_buffers: true,
  },
);

const redises = [redisClientOriginal, redisClientMsgPack, redisClientSetPacked, redisClientSet];

redises.forEach((client) => {
  client.on('error', (err) => {
    console.log();
    console.error('error1', err);
    process.exit(1);
  });
});

let countFound = 0;

async function run(type, redisClient, doRead) {
  countFound = 0;
  console.log(`Starting with ${type}`);
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys found: {found}',
  });
  progressBar.start(100000, 0, { found: 0 });
  const batchSize = 10000;
  const scanOptions = {
    MATCH: '*',
    COUNT: batchSize,
  };
  console.time(`Execution Time ${type}`);
  const start = Date.now();
  // eslint-disable-next-line no-restricted-syntax
  for await (const key of redisClient.scanIterator(scanOptions)) {
    countFound += 1;
    await doRead(key);
    progressBar.update(1, { found: countFound });
  }
  const end = Date.now();
  console.log();
  console.log(`Done with ${countFound}`);
  console.log(`Execution time of ${type}: ${end - start} ms`);
  console.timeEnd(`Execution Time ${type}`);
  console.log();
}

async function runAll() {
  await redisClientOriginal.connect();
  await run('original', redisClientOriginal, async (key) => {
    const value = await redisClientOriginal.get(commandOptions({ returnBuffers: true }), key);
    const valPacked = msgpack.unpack(value);
  });
  await redisClientOriginal.quit();

  await redisClientMsgPack.connect();
  await run('msgpack', redisClientMsgPack, async (key) => {
    const value = await redisClientMsgPack.get(commandOptions({ returnBuffers: true }), key);
    const valPacked = msgpack.unpack(value);
  });
  await redisClientMsgPack.quit();

  await redisClientSet.connect();
  await run('set', redisClientSet, async (key) => {
    const value = await redisClientSet.sMembers(key);
  });
  await redisClientSet.quit();

  await redisClientSetPacked.connect();
  await run('setpacked', redisClientSetPacked, async (key) => {
    const values = await redisClientSetPacked.sMembers(commandOptions({ returnBuffers: true }), key);
    const result = values.map((value) => msgpack.unpack(value));
  });
  await redisClientSetPacked.quit();
}

runAll()
  .then(() => {
    console.log();
    console.log(`Done with ${countFound}`);
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
