'use strict';

const { parseSnapshot, importBin } = require('./lib/json-parse.js');
const print = process._rawDebug;

// [ 'snapshot' ] 12 749 737
// [ 'nodes' ] 759 690470434 690469675
// [ 'edges' ] 690470444 1981644042 1291173598
// [ 'trace_function_infos' ] 1981644067 1981644069 2
// [ 'trace_tree' ] 1981644084 1981644086 2
// [ 'samples' ] 1981644098 1981644100 2
// [ 'strings' ] 1981644112 2278098259 296454147

const file_path = process.argv[2];


const da = importBin(file_path);
print('nodes', da.nodes.byteLength);
print('edges', da.edges.byteLength);
print('_strings_indexes', da._strings_indexes.byteLength);
print('_strings', da._strings.byteLength);
return;



//const fs = require('fs');
//const fd = fs.openSync(file_path, 'r');
//const b = Buffer.alloc(100);
//fs.readSync(fd, b, 0, b.byteLength, 1981644043);
//print(b.toString());
//return;



const accessor = parseSnapshot(file_path);

//print(accessor.snapshot);
print('nodes', accessor.nodes.byteLength);
print('edges', accessor.edges.byteLength);
print('_strings_indexes', accessor._strings_indexes.byteLength);
print('_strings', accessor._strings.byteLength);
print('-----------------');
print(accessor.getString(0));
print(accessor.getString(10));
print(accessor.getString(1000));
print(accessor.getString(100000));
print('-----------------');


print(accessor.writeToFile('./app-snapshot.bin'));
