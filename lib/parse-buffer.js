'use strict';

const print = process._rawDebug;

module.exports = {
  parseStringsBuffer,
};


function parseStringsBuffer(buf) {
  let index_array = new Uint32Array(0x800000);
  let index_offset = 0;
  let in_string = false;
  let escaped = false;
  let ret = [];
  const limit = buf.byteLength;

  for (let offset = 0; offset < limit; offset++) {
    const c = buf[offset];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (c === 0x5c /* '\\' */) {
      escaped = true;
      continue;
    }

    // whether we're in a string or not, the next character we care about is
    // an unescaped '"'
    if (c !== 0x22 /* '"' */)
      continue;

    if (!in_string) {
      in_string = true;
      index_array[index_offset] = offset;
      index_offset++;
      continue;
    }

    // reached the end of a string
    index_array[index_offset] = offset + 1;
    index_offset++;
    in_string = false;
    if (index_offset >= index_array.length) {
      ret.push(index_array);
      index_array = new Uint32Array(0x800000);
      index_offset = 0;
    }
  }

  ret.push(index_array.subarray(0, index_offset));
  return concatArray(ret);
}


function concatArray(array) {
  let length = 0;
  for (let i = 0; i < array.length; i++)
    length += array[i].length;
  const ui32 = new Uint32Array(length);
  for (let i = 0; i < array.length; i++) {
    ui32.set(array[i], i * 0x800000);
  }
  return ui32;
}
