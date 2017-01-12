'use strict';

const parseSnapshot = require('./lib/json-parse.js');
const print = process._rawDebug;

// [ 'snapshot' ] 12 749 737
// [ 'nodes' ] 759 690470434 690469675
// [ 'edges' ] 690470444 1981644042 1291173598
// [ 'trace_function_infos' ] 1981644067 1981644069 2
// [ 'trace_tree' ] 1981644084 1981644086 2
// [ 'samples' ] 1981644098 1981644100 2
// [ 'strings' ] 1981644112 2278098259 296454147

const file_path = process.argv[2];

//const fs = require('fs');
//const fd = fs.openSync(file_path, 'r');
//const b = Buffer.alloc(100);
//fs.readSync(fd, b, 0, b.byteLength, 1981644043);
//print(b.toString());
//return;


const accessor = parseSnapshot(file_path);

//print(accessor.snapshot);
print('nodes', accessor.nodes.length);
print('edges', accessor.edges.length);
print('_strings_indexes', accessor._strings_indexes.length);
print('strings', accessor._strings.byteLength);
print(accessor._strings.toString(
  'latin1', accessor._strings.byteLength - 100, accessor._strings.byteLength));
