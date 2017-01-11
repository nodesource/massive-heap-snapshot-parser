'use strict';

const fs = require('fs');
const DepthStream = require('json-depth-stream');
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
const fd_strings = fs.readSync(fd, buf, 0, buf.byteLength, 1981644112);
print('loaded ', buf.byteLength);
//print(buf.slice(0, 100).toString());


function isWhitespace(c) {
  return c === 0x20 /* ' ' */ || c === 0x09 /* '\t' */ ||
         c === 0x0a /* '\n' */ || c === 0x0d; /* '\r' */
}

function splitArray(buf_array) {
  const limit = buf_array.byteLength;
  let index_offsets = new Uint32Array(0x800000);  // 32 MB
  let offsets_offset = 1;
  let offset = 0;
  let escape_next = false;
  let in_string = false;
  let in_value = false;

  // first run until non-whitespace is found
  if (isWhitespace(buf_array[0])) {
    for (offset = 1; offset < limit; offset++) {
      if (!isWhitespace(buf_array[offset])) continue;
    }
  }

  // now make sure the first character is a [
  if (buf_array[offset] !== 0x5b /* '[' */) {
    throw new SyntaxError('array should open with an "["');
  }

  for (; offset < limit; offset++) {
    const c = chunk[offset];

    if (escape_next) {
      escape_next = false;
      continue;
    }

    if (c === 0x5c /* '\\' */) {
      escape_next = true;
      continue;
    }

    if (in_string) {
      if (c !== 0x22 /* '"' */)
        continue;
      index_offsets[offsets_offset] = offset;
      in_string = false;
      continue;
    }
  }

  if (in_value) {
    if (c === 0x2c /* ',' */) {
      index_offsets[offsets_offset] = offset - 1;
    }
    if (!isWhitespace(c) || c !== 0x2c /* ',' */)
      continue;
  }
}


function printNodes() {
  const file_path = process.argv[2];
  const file = fs.createReadStream(file_path);
  const json = new DepthStream(1);
  json.on('visit', (path, start, end) => {
    console.log(path, start, end, end - start);
  });
  file.pipe(json);
}
