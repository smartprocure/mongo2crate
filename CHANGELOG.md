# 0.21.2

- Fixed an issue when updating a nested field like `foo.bar` or `foo.0.bar`.

# 0.21.1

- Forgot to bump `prom-utils` in this repo.

# 0.21.0

- Latest `mongochangestream` - `batchBytes` option.

# 0.20.0

- Return `emitter` with events: `process` and `error`.
- Stats are no longer logged.
- Use `BIGINT` column type for `number` when creating table schema.

# 0.19.0

- Removed `clearCompletedOn`.
- Latest `mongochangestream` - `JSONSchema` type.

# 0.18.0

- Latest `mongochangestream` - Option to strip metadata from a JSON schema for `detectSchemaChange`.

# 0.17.0

- Latest `mongochangestream` - Ensure that you can call `start` after calling `stop`.

# 0.16.0

- Expose `schemaName`, `tableName`, `qualifiedName`.

# 0.15.0

- Schema can be set instead of defaulting to `doc`.

# 0.14.0

- Option to set `tableName`.
- Handle `replace` event.
- Latest `mongochangestream`.

# 0.13.2

- Latest `mongochangestream` with bug fix.

# 0.13.0

- Latest `mongochangestream`.

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
