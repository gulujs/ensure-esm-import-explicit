#!/usr/bin/env node

import * as fs from 'fs';
import * as Path from 'path';
import { program } from 'commander';
import { EnsureEsmImportExplicitTransformer } from '../index.js';

const pkgFile = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(pkgFile, { encoding: 'utf-8' }));

program.version(pkg.version);

program
  .requiredOption('--source <string>', 'source dir')
  .option('--in-place', 'transform in place', false)
  .option('--dest <string>', 'dest dir')
  .option('--ext <string>', 'file extension', 'js')
  .option('--ts', 'is typescript files', false)
  .option('--print', 'print process', false)
  .parse();

const options = program.opts();

if (!options.inPlace && !options.dest) {
  console.error('error: option \'--dest <string>\' not specified');
  // eslint-disable-next-line node/no-process-exit
  process.exit(1);
}

if (!options.inPlace) {
  if (Path.resolve(options.source) === Path.resolve(options.dest)) {
    console.error('source path is same as dest path, maybe you should use "--in-place"');
    // eslint-disable-next-line node/no-process-exit
    process.exit(1);
  }
}


const transformer = new EnsureEsmImportExplicitTransformer(options);
if (options.print) {
  transformer.on('file', (file, n, total) => {
    if (n === 1) {
      console.log(`Processing: ${n} / ${total}\t${file.path}`);
    } else {
      console.log(`\x1b[1F\x1b[KProcessing: ${n} / ${total}\t${file.path}`);
    }
  });
  transformer.on('done', () => {
    console.log('\x1b[1F\x1b[KProcessing: Done');
  });
}

transformer.transform().catch((e) => {
  console.error(e.message);
  // eslint-disable-next-line node/no-process-exit
  process.exit(1);
});
