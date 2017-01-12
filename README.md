## Massive Heap Snapshot Parser

### Install

To install just do:
```
$ npm install mhsp
```

### Usage

This API will extract `"snapshot"`, `"nodes"`, `"edges"` and `"strings"` from
very large snapshots in a way that allows you to continue working with them. It
doesn't however show `"trace_function_infos"`, `"trace_tree"` or `"samples"`.
Mainly because I don't need them right now. File an issue or open a PR if you'd
like to help.

#### `parseSnapshot(path)`

* Returns `DataAccessor` instance

This does all the magic. Just give it a path to a snapshot and it'll
automatically do everything for you. Here's an example:

```js
'use strict';
const { parseSnapshot } = require('mhsp');

const accessor = parseSnapshot('./my-big.heapsnapshot');
```

Warning that for large snapshots this can take several minutes. 

#### `accessor.snapshot`

* Is `Object`

This is the metadata object that contains various information about the
snapshot.

#### `accessor.nodes`

* Is a `Uint32Array`

This is a `Uint32Array` of all the nodes in the snapshot. Go ahead and access
it by index.

#### `accessor.edges`

* Is a `Uint32Array`

This is also a `Uint32Array` that can be accessed by index.

#### `accessor.getString(index)`

* Returns `String`

Returning strings from the `"strings"` field isn't as straight forward. Some
fun index tracking is done under the hood so the entire `"strings"` section can
live in one big `Buffer`.

#### `accessor.writeToFile(path)`

* Returns `Number` of bytes written to disk

Since generating the accessor takes so long you can go ahead and write the
entire thing to disk in the form of a binary blob. Can then use `importBin()`
to read it back in later. Is much much faster.

#### `importBin(path)`

* Returns `DataAccessor` instance

Read in files that have already been processed and written to disk as binary
blobs. On my i7 the first time I process a 2GB snapshot can take over 1.5
minutes. But reading it back in this way only takes a few seconds. Highly
recommended.
