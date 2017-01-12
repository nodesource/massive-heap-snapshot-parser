'use strict';

const { parseSnapshot, importBin } = require('../main.js');
const print = process._rawDebug;

// first we need the path of the heapsnapshot
const file_path = __dirname + '/small.heapsnapshot';

// now create our accessor to snapshot. this is computationally expensive and
// may take a few minutes.
const accessor = parseSnapshot(file_path);

// show the snapshot object and the number of nodes and edges. each are just a
// Uint32Array that can be accessed by index.
print(accessor.snapshot);
print('nodes', accessor.nodes.length);
print('edges', accessor.edges.length);
print('_strings_indexes', accessor._strings_indexes.length);
print('_strings', accessor._strings.length);
print('-----------------');

// retrieve a couple strings from the snapshot
print(accessor.getString(0));
print(accessor.getString(10));
print('-----------------');


// generating the accessor takes a long time. so go ahead and write the binary
// blob of a result to disk. the return value is the number of bytes written.
print(accessor.writeToFile(__dirname + '/app-snapshot.bin'));

// let's import it from disk
const da = importBin(__dirname + '/app-snapshot.bin');

// view the number of nodes and edges again
print('nodes', da.nodes.length);
print('edges', da.edges.length);
print('_strings_indexes', da._strings_indexes.length);
print('_strings', da._strings.length);
print('-----------------');

// retrieve a couple strings to end this
print(da.getString(0));
print(da.getString(10));
