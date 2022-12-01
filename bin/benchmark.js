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
let data = [];

async function run(type, doWrite) {
  countFound = 0;
  console.log();
  console.log(`Starting with ${type}`);
  console.time(`Execution Time ${type}`);
  const start = Date.now();
  const progressBar = new cliProgress.Bar({
    format: 'progress [{bar}] DB scanned: {percentage}% || Keys scanned: {value} || Keys found: {found}',
  });
  progressBar.start(data.length, 0, { found: 0 });

  // eslint-disable-next-line no-restricted-syntax
  // for await (const redisData of data) {
  //   countFound += 1;
  //   await doWrite(redisData.key, redisData.value);
  //   progressBar.update(data.length, { found: countFound });
  // }

  await Promise.all(data.map((redisData) => {
    countFound += 1;
    progressBar.update(data.length, { found: countFound });
    return doWrite(redisData.key, redisData.value);
  }));

  const end = Date.now();
  console.log();
  console.log(`Done with ${countFound}`);
  console.log(`Execution time of ${type}: ${end - start} ms`);
  console.timeEnd(`Execution Time ${type}`);
}

async function getData() {
  const batchSize = 10000;
  const scanOptions = {
    MATCH: '*',
    COUNT: batchSize,
  };
  const redisValues = [];
  let cursor = '0';
  do {
    const reply = await redisClient.scan(cursor, scanOptions);
    // eslint-disable-next-line prefer-destructuring
    cursor = reply.cursor;
    const { keys } = reply;
    const values = await Promise.all(keys.map((key) => redisClient.get(commandOptions({ returnBuffers: true }), key)));
    // eslint-disable-next-line no-loop-func
    values.forEach((value, index) => {
      redisValues.push({
        key: keys[index],
        value: msgpack.unpack(value),
      });
    });
  } while (cursor);
  return redisValues;
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
  data = await getData();
  // return;

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
    const array = valPacked.split('.');
    await redisClientSet.sAdd(key, array);
  });
  await redisClientSet.quit();

  await redisClientSetPacked.connect();
  await run('setPacked', async (key, valPacked) => {
    const array = valPacked.split('.')
      .map((a) => msgpack.pack(parseInt(a, 10)));
    await redisClientSetPacked.sAdd(key, array);
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
