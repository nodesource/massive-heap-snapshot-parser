'use strict';

const print = process._rawDebug;

const STATE_VALUE = 0;
const STATE_STRING = 1;
const STATE_OBJECT = 3;
const STATE_OBJECT_KEY = 4;
const STATE_OBJECT_VALUE = 5;
const STATE_ARRAY = 6;
const STATE_ARRAY_VALUE = 7;
const STATE_SKIP = 8;

module.exports = parseBuffer;


function parseBuffer(buf, start, end) {
  let index_list = new Uint32Array(0x800000);  // 32 MB
  let index_offset = 0;
  let state = STATE_VALUE;
  let escape = 0;
  let nonws = 0;
  let curly = 0;
  let square = 0;
  let quote = 0;
  let offset = start || 0;
  let keyStart = start || 0;

  const maxDepth = 1;
  const limit = end === undefined ? buf.byteLength : end;

  for (; offset < limit; offset++) {
    const c = buf[offset];

    if (escape !== 0) {
      escape--;
      nonws++;
      continue;
    }

    if (c === 0x5c /* '\\' */) {
      escape = 1;
      nonws++;
      continue;
    }
  }
}


function isWhitespace(c) {
  return c === 0x20 /* ' ' */ || c === 0x09 /* '\t' */ ||
         c === 0x0a /* '\n' */ || c === 0x0d; /* '\r' */
}

