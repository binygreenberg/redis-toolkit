#!/usr/bin/env node
const redis = require('redis');
const cliProgress = require('cli-progress');
const { commandOptions } = require('redis');
const msgpack = require('msgpack');

const redisClient = redis.createClient(
  {
    socket: {
      host: 'localhost',
      port: 5555,
    },
    return_buffers: true,
  },
);

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

[redisClient, redisClientOriginal, redisClientMsgPack, redisClientSetPacked, redisClientSet].forEach((client) => {
  client.on('error', (err) => {
    console.log();
    console.error('error1', err);
    process.exit(1);
  });
});

let countFound = 0;

async function run(type, doWrite) {
  countFound = 0;
  console.log();
  console.log(`Starting with ${type}`);
  const dbSize = await redisClient.dbSize();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys found: {found}',
  });
  progressBar.start(dbSize, 0, { found: 0 });
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
    const value = await redisClient.get(commandOptions({ returnBuffers: true }), key);
    const valPacked = msgpack.unpack(value);
    doWrite(key, valPacked);
    progressBar.update(1, { found: countFound });
  }
  const end = Date.now();
  console.log();
  console.log(`Done with ${countFound}`);
  console.log(`Execution time of ${type}: ${end - start} ms`);
  console.timeEnd(`Execution Time ${type}`);
}

async function flushAll() {
  const promises = [redisClientOriginal, redisClientMsgPack, redisClientSet, redisClientSetPacked].map(async (client) => {
    await client.connect();
    await client.flushAll();
    await client.memoryPurge();
    await client.quit();
  });
  await Promise.all(promises);
}

async function runAll() {
  await redisClient.connect();
  await flushAll();

  await redisClientOriginal.connect();
  await run('original', async (key, valPacked) => {
    const saveValue = msgpack.pack(valPacked);
    await redisClientOriginal.set(key, saveValue);
  });
  await redisClientOriginal.quit();

  await redisClientMsgPack.connect();
  await run('msgpack', async (key, valPacked) => {
    const arrayValue = valPacked.split('.')
      .map((a) => parseInt(a, 10));
    const saveValue = msgpack.pack(arrayValue);
    await redisClientMsgPack.set(key, saveValue);
  });
  await redisClientMsgPack.quit();

  await redisClientSet.connect();
  await run('set', async (key, valPacked) => {
    const arrayValue = valPacked.split('.')
      .map((a) => a.toString());
    await redisClientSet.sAdd(key, arrayValue);
  });
  await redisClientSet.quit();

  await redisClientSetPacked.connect();
  await run('setPacked', async (key, valPacked) => {
    const arrayValue = valPacked.split('.')
      .map((a) => msgpack.pack(parseInt(a, 10)));
    await redisClientSetPacked.sAdd(key, arrayValue);
  });
  await redisClientSetPacked.quit();

  await redisClient.quit();
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
