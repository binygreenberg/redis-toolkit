#!/usr/bin/env node

var program = require('commander');

program
  .version('0.0.1')
  .description('Redis Tools')
  .command('analyze', 'analyze memory usage')
  .command('delete', 'delete keys of specific pattern')
  .parse(process.argv);
