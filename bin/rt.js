#!/usr/bin/env node

var program = require('commander');

program
  .version('0.0.1')
  .description('Redis Tools')
  .command('analyze', 'analyze memory usage').alias('a')
  .command('delete', 'delete keys with regex')
  .parse(process.argv);
