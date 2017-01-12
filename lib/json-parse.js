'use strict';

const assert = require('assert');
const fs = require('fs');
const print = process._rawDebug;
const READ_BUF_SIZE = 0x2000000;  // 32 MB
let read_buf = null;


module.exports = {
  parseSnapshot,
  importBin,
};


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
  const ret = [];
  let index_array = new Uint32Array(0x800000);
  let index_offset = 0;
  let byte_offset = 0;
  let end_last_word = offset;
  let amount_read = READ_BUF_SIZE;

  let foop = false;
  outerloop:
  while (amount_read >= READ_BUF_SIZE) {
    let in_string = false;
    let escaped = false;
    amount_read = fs.readSync(fd, read_buf, 0, READ_BUF_SIZE, end_last_word);

    for (let chunk_offset = 0;
         chunk_offset < READ_BUF_SIZE;
         chunk_offset++, byte_offset++) {
      const c = read_buf[chunk_offset];

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

      if (c === 0x5d /* ']' */ && !in_string) {
        break outerloop;
      }

      if (!in_string) {
        in_string = true;
        index_array[index_offset] = byte_offset + 1;
        index_offset++;
        continue;
      }

      // reached the end of a string
      index_array[index_offset] = byte_offset;
      end_last_word = offset + index_array[index_offset];
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
  return [end_last_word, concatArray(ret)];
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
// strings - string array
function DataAccessor(file_path) {
  this.snapshot = null;
  this.nodes = null;
  this.edges = null;
  this._strings_indexes = null;
  this._strings = null;

  // For internal use
  if (file_path === null) return;

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

  // TODO(trevnorris): should probably keep reading to find the beginning of
  // '"strings"', but not that worried about it for now.
  fs.readSync(fd, read_buf, 0, READ_BUF_SIZE, offset);
  const indexof_strings = read_buf.indexOf('\n"strings":');
  if (indexof_strings === -1)
    throw new Error('UNREACHABLE');
  // jump past '\n"strings":['
  offset += indexof_strings + 12;

  const strings_start = offset;
  [offset, this._strings_indexes] = parseStringsBuffer(fd, strings_start);
  this._strings = Buffer.alloc(offset - strings_start);
  fs.readSync(fd, this._strings, 0, this._strings.byteLength, strings_start);

  read_buf = null;
  fs.closeSync(fd);
}


DataAccessor.prototype.getString = function getString(index) {
  return this._strings.toString(
    'utf8',
    this._strings_indexes[index * 2],
    this._strings_indexes[index * 2 + 1]);
};


// Read and write out in this order:
//  snapshot, nodes, edges, _strings_indexes, _strings
DataAccessor.prototype.writeToFile = function writeToFile(path) {
  const fd = fs.openSync(path, 'w');
  let position = 0;

  // first write the snapshot to disk
  const snapshot_string = JSON.stringify(this.snapshot);
  const snapshot_size = Buffer.byteLength(snapshot_string);
  const snapshot_buffer = Buffer.alloc(snapshot_size + 4);
  snapshot_buffer.writeUInt32LE(snapshot_size, 0);
  snapshot_buffer.write(snapshot_string, 4);
  position += fs.writeSync(
    fd, snapshot_buffer, 0, snapshot_buffer.byteLength, position);

  // then write nodes to disk
  const b_length = Buffer.alloc(4);
  const b_nodes = Buffer.from(this.nodes.buffer);
  b_length.writeUInt32LE(b_nodes.byteLength, 0);
  position += fs.writeSync(fd, b_length, 0, b_length.byteLength, position);
  position += fs.writeSync(fd, b_nodes, 0, b_nodes.byteLength, position);

  // then write edges to disk
  const b_edges = Buffer.from(this.edges.buffer);
  b_length.writeUInt32LE(b_edges.byteLength, 0);
  position += fs.writeSync(fd, b_length, 0, b_length.byteLength, position);
  position += fs.writeSync(fd, b_edges, 0, b_edges.byteLength, position);

  // then _strings_indexes
  const b_indexes = Buffer.from(this._strings_indexes.buffer);
  b_length.writeUInt32LE(b_indexes.byteLength, 0);
  position += fs.writeSync(fd, b_length, 0, b_length.byteLength, position);
  position += fs.writeSync(fd, b_indexes, 0, b_indexes.byteLength, position);

  // finally _strings
  b_length.writeUInt32LE(this._strings.byteLength, 0);
  position += fs.writeSync(fd, b_length, 0, b_length.byteLength, position);
  position += fs.writeSync(
    fd, this._strings, 0, this._strings.byteLength, position);

  fs.closeSync(fd);

  return position;
};


function importBin(path) {
  const fd = fs.openSync(path, 'r');
  const da = new DataAccessor(null);
  const b_length = Buffer.alloc(4);
  let bytesRead = 0;
  let position = 0;
  let allocSize = 0;

  // first snapshot
  position += bytesRead = fs.readSync(
    fd, b_length, 0, b_length.byteLength, position);
  assert.equal(bytesRead, 4);
  allocSize = b_length.readUInt32LE(0);
  const b_snapshot = Buffer.alloc(allocSize);
  position += bytesRead = fs.readSync(fd, b_snapshot, 0, allocSize, position);
  assert.equal(bytesRead, allocSize);
  da.snapshot = JSON.parse(b_snapshot);

  // then nodes
  position += bytesRead = fs.readSync(
    fd, b_length, 0, b_length.byteLength, position);
  assert.equal(bytesRead, 4);
  allocSize = b_length.readUInt32LE(0);
  const b_nodes = Buffer.alloc(allocSize);
  position += bytesRead = fs.readSync(fd, b_nodes, 0, allocSize, position);
  assert.equal(bytesRead, allocSize);
  da.nodes = new Uint32Array(b_nodes.buffer);

  // then edges
  position += bytesRead = fs.readSync(
    fd, b_length, 0, b_length.byteLength, position);
  assert.equal(bytesRead, 4);
  allocSize = b_length.readUInt32LE(0);
  const b_edges = Buffer.alloc(allocSize);
  position += bytesRead = fs.readSync(fd, b_edges, 0, allocSize, position);
  assert.equal(bytesRead, allocSize);
  da.edges = new Uint32Array(b_edges.buffer);

  // then _strings_indexes
  position += bytesRead = fs.readSync(
    fd, b_length, 0, b_length.byteLength, position);
  assert.equal(bytesRead, 4);
  allocSize = b_length.readUInt32LE(0);
  const b_indexes = Buffer.alloc(allocSize);
  position += bytesRead = fs.readSync(fd, b_indexes, 0, allocSize, position);
  assert.equal(bytesRead, allocSize);
  da._strings_indexes = new Uint32Array(b_indexes.buffer);

  // finally _strings
  position += bytesRead = fs.readSync(
    fd, b_length, 0, b_length.byteLength, position);
  assert.equal(bytesRead, 4);
  allocSize = b_length.readUInt32LE(0);
  const b_strings = Buffer.alloc(allocSize);
  position += bytesRead = fs.readSync(fd, b_strings, 0, allocSize, position);
  assert.equal(bytesRead, allocSize);
  da._strings = b_strings;

  return da;
}
