#!/usr/bin/env node

const program = require('commander');

program
  .version(require('../package.json').version)
  .description('Redis Tools')
  .command('analyze', 'analyze memory usage')
  .command('delete', 'delete keys of specific pattern')
  .command('search', 'search for keys of specific pattern')
  .command('copy', 'copy redis data by specific pattern')
  .parse(process.argv);
