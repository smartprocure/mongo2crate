# 0.35.0

- Latest `mongochangestream` - Drop health check code in favor of `cursorError` event.

# 0.34.0

- Latest `mongochangestream` - extend event types.

# 0.33.0

- Latest `mongochangestream` - `runInitialScan` pipeline.

# 0.32.0

- Optionally pass `mapper` for an override.

# 0.31.0

- Glob expressions supported for overrides `path`.
- Pass any key/value pair in `Override` object.

# 0.30.0

- Latest `mongochangestream` - Handle master failover scenario properly for initial scan.

# 0.29.0

- Latest `mongochangestream` - Longer `maxSyncDelay` default.

# 0.28.0

- Emit initial scan errors.

# 0.27.1

- Export `detectResync`.

# 0.27.0

- Latest `mongochangestream` - More robust cursor consumption.

# 0.26.0

- Added `flags` to `overrides`, including: `notNull`, `indexOff`, and `columnStoreOff`.

# 0.25.0

- Latest `mongochangestream` - Bug fix.

# 0.24.0

- Latest `mongochangestream` - generic emitter.
- Use emitter from `mongochangestream` which now emits two events on its own.

# 0.23.1

- Latest `mongochangestream` - bug fix.

# 0.23.0

- Latest `mongochangestream` - health checks.

# 0.22.0

- Add support for generating `CREATE TABLE IF NOT EXISTS (...fields) WITH (column_policy = 'dynamic')`
  when json schema has `additionalProperties` set to true at the root

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
