# 0.12.0

- Latest `mongochangestream`.

# 0.11.0

- Pass along `reset` and other `mongochangestream` fns.

# 0.10.0

- Latest `mongochangestream`.
- `detectSchemaChange`.

# 0.9.1

- Force path to be a string to conform to the change stream omit option.

# 0.9.0

- Changed `convertSchema` to accept `omit` and `overrides`.
`overrides` allow you to override the bsonType of any path.

# 0.8.0

- Added `getCollectionSchema`.
- Added `createTableFromSchema`.

# 0.7.0

- Second parameter should be optional for `crate.query`.

# 0.6.0

- Added peer dependencies.
- Latest `mongochangestream`.

# 0.5.0

- Latest `mongochangestream`.

# 0.4.0

- Better defaults for `initSync`.
- Better parameters for `crate`.

# 0.3.0

- Change argument order for `initSync`.

# 0.2.0

- Latest `mongochangestream`.
- Omit fields via `initSync` which uses the pipeline for change stream events.
- Changed `initSync` options.
- Added `pipeline` argument to `processChangeStream`.

# 0.1.0

- Initial release.
