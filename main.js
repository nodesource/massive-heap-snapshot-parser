'use strict';

const fs = require('fs');
const DepthStream = require('json-depth-stream');
const parseBuffer = require('./lib/parse-buffer.js');
const print = process._rawDebug;

// [ 'snapshot' ] 12 749 737
// [ 'nodes' ] 759 690470434 690469675
// [ 'edges' ] 690470444 1981644042 1291173598
// [ 'trace_function_infos' ] 1981644067 1981644069 2
// [ 'trace_tree' ] 1981644084 1981644086 2
// [ 'samples' ] 1981644098 1981644100 2
// [ 'strings' ] 1981644112 2278098259 296454147

const file_path = process.argv[2];
const fd = fs.openSync(file_path, 'r');

const buf = Buffer.alloc(296454147);
const strings_buf = fs.readSync(fd, buf, 0, buf.byteLength, 1981644112);
const array_offsets = parseBuffer(strings_buf);
//print('loaded ', buf.byteLength);
//print(buf.slice(0, 100).toString());


function printNodes() {
  const file_path = process.argv[2];
  const file = fs.createReadStream(file_path);
  const json = new DepthStream(1);
  json.on('visit', (path, start, end) => {
    console.log(path, start, end, end - start);
  });
  file.pipe(json);
}
