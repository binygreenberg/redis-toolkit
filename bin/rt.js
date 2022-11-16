#!/usr/bin/env node

const program = require('commander');

program
  .version(require('../package.json').version)
  .description('Redis Tools')
  .command('analyze', 'analyze memory usage')
  .command('delete', 'delete keys of specific pattern')
  .command('search', 'search for keys of specific pattern')
  .command('msgpack', 'do msgpack of specific pattern')
  .command('hset', 'save value as set')
  .command('write', 'do write to another redis')
  .parse(process.argv);
