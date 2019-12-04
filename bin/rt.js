#!/usr/bin/env node

var program = require('commander');

program
  .version('1.0.3')
  .description('Redis Tools')
  .command('analyze', 'analyze memory usage')
  .command('delete', 'delete keys of specific pattern')
  .parse(process.argv);
