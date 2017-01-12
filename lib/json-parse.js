'use strict';

const fs = require('fs');
const DepthStream = require('json-depth-stream');
const print = process._rawDebug;
const READ_BUF_SIZE = 0x2000000;  // 32 MB
let read_buf = null;


module.exports = parseSnapshot;


function parseSnapshot(file_path) {
  return new DataAccessor(file_path);
}


function parseSnapshotObject(fd) {
  let offset = 12; // skip to object
  let obj = null;
  let snapshot_string = '';

  while (offset < READ_BUF_SIZE) {
    fs.readSync(fd, read_buf, 0, READ_BUF_SIZE, offset);
    for (let i = 0; i < READ_BUF_SIZE; i++, offset++) {
      if (read_buf[i] === 0x0a) {
        return [offset, JSON.parse(snapshot_string + read_buf.slice(0, i - 1))];
      }
    }
    snapshot_string += read_buf.toString();
  }

  throw new Error('UNREACHABLE');
}


function parseNumericArray(fd, offset) {
  let amount_read = READ_BUF_SIZE;
  let array_size = 1;
  let offset_dup = offset;

  // quick scan to see how many elements there are
  outerloop:
  while (amount_read >= READ_BUF_SIZE) {
    amount_read = fs.readSync(fd, read_buf, 0, READ_BUF_SIZE, offset_dup);
    for (var i = 0; i < READ_BUF_SIZE; i++) {
      if (read_buf[i] === 0x5d /* ']' */)
        break outerloop;
      if (read_buf[i] === 0x2c /* ',' */)
        array_size++;
    }
    offset_dup += READ_BUF_SIZE;
  }

  const ui32_array = new Uint32Array(array_size);
  let ui32_offset = 0;
  amount_read = READ_BUF_SIZE;

  while (amount_read >= READ_BUF_SIZE) {
    amount_read = fs.readSync(fd, read_buf, 0, READ_BUF_SIZE, offset);
    const indexof_bracket = read_buf.indexOf(']');

    // haven't reached the end of the array
    if (indexof_bracket === -1) {
      const last_comma = read_buf.lastIndexOf(',');
      if (last_comma === -1) throw new Error('UNREACHABLE');
      // turn back offset for the next read
      offset += last_comma + 1;
      const num_array =
        JSON.parse(`[${read_buf.toString('latin1', 0, last_comma)}]`);
      for (let i = 0; i < num_array.length; i++) {
        ui32_array[ui32_offset++] = num_array[i];
      }
      continue;
    }

    offset += indexof_bracket;
    const num_array =
      JSON.parse(`[${read_buf.toString('latin1', 0, indexof_bracket)}]`);
    for (let i = 0; i < num_array.length; i++) {
      ui32_array[ui32_offset++] = num_array[i];
    }
    return [offset + 2, ui32_array];
  }

  throw new Error('UNREACHABLE');
}


function parseStringsBuffer(fd, offset) {
  let index_array = new Uint32Array(0x800000);
  let ret = [];
  let index_offset = 0;
  let amount_read = READ_BUF_SIZE;

  outerloop:
  while (amount_read >= READ_BUF_SIZE) {
    let in_string = false;
    let escaped = false;
    amount_read = fs.readSync(fd, read_buf, 0, READ_BUF_SIZE, offset);
    index_offset = 0;

    for (let chunk_offset = 0; chunk_offset < READ_BUF_SIZE; chunk_offset++) {
      const c = read_buf[chunk_offset];
      offset++;

      if (escaped) {
        escaped = false;
        continue;
      }

      if (c === 0x5d /* ']' */ && !in_string)
        break outerloop;

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
        index_array[index_offset] = chunk_offset;
        index_offset++;
        continue;
      }

      // reached the end of a string
      index_array[index_offset] = chunk_offset + 1;
      index_offset++;
      in_string = false;
      if (index_offset >= index_array.length) {
        ret.push(index_array);
        index_array = new Uint32Array(0x800000);
        index_offset = 0;
      }
    }
  }


  ret.push(index_array.subarray(0, index_offset));
  return [offset, concatArray(ret)];
}


function concatArray(array) {
  let total_length = 0;
  for (let i = 0; i < array.length; i++)
    total_length += array[i].length;
  const ui32 = new Uint32Array(total_length);
  for (let i = 0; i < array.length; i++) {
    ui32.set(array[i], i * 0x800000);
  }
  return ui32;
}



// Fields to find (in this order):
// snapshot - object
// nodes - numeric array
// edges - numeric array
// trace_function_infos - (empty array)
// trace_tree - (empty array)
// samples - (empty array)
// strings - string array
function DataAccessor(file_path) {
  const fd = fs.openSync(file_path, 'r');
  let offset = 0;
  read_buf = Buffer.alloc(READ_BUF_SIZE);

  [offset, this.snapshot] = parseSnapshotObject(fd);

  // sanity check
  fs.readSync(fd, read_buf, 0, 10, offset);
  if (read_buf.toString('latin1', 0, 10) !== '\n"nodes":[')
    throw new Error('UNREACHABLE ' + read_buf.toString('hex', 0, 10));

  // jump past '"nodes":['
  [offset, this.nodes] = parseNumericArray(fd, offset + 10);

  // sanity check
  fs.readSync(fd, read_buf, 0, 10, offset);
  if (read_buf.toString('latin1', 0, 10) !== '\n"edges":[')
    throw new Error('UNREACHABLE ' + read_buf.toString('hex', 0, 10));

  // jump past '"edges":['
  [offset, this.edges] = parseNumericArray(fd, offset + 10);

  fs.readSync(fd, read_buf, 0, READ_BUF_SIZE, offset);
  const indexof_strings = read_buf.indexOf('\n"strings":');
  // TODO(trevnorris): should probably keep reading to find the beginning of
  // '"strings"', but not that worried about it for now.
  if (indexof_strings === -1)
    throw new Error('UNREACHABLE');
  offset += indexof_strings;

  // jump past '\n"strings":['
  offset += 12;
  const strings_start = offset;
  [offset, this._strings_indexes] = parseStringsBuffer(fd, strings_start);
  this._strings = Buffer.alloc(offset - strings_start);
  fs.readSync(fd, this._strings, 0, this._strings.byteLength, strings_start);

  read_buf = null;
  fs.closeSync(fd);
}


DataAccessor.prototype.getString = function getString(index) {
  this._strings.slice(this._strings_indexes[index * 2],
                      this._strings_indexes[index * 2 + 1]).toString();
};
