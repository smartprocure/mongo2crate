# 0.54.0

- Latest `mongochangestream` - Move retry logic to `mongochangestream`.
- Removed `immutable` option.

# 0.53.0

- Retry for up to 24 hours if the exception is not `DuplicateKeyException`.

# 0.52.0

- Latest `mongochangestream` - Fix for downstream `processRecords` mutation.

# 0.51.0

- Fix to `process` event `failed` property.
- Latest `mongochangestream` - Add `lastFlush` to `stats` event.

# 0.50.0

- Latest `mongochangestream` - Fix pseudo ChangeStreamInsertDocument record.

# 0.49.0

- **Deprecated** `immutable` option for `processChangeStream` in favor of `autoOptimizeInserts` option that works well in an insert-only
  or insert-heavy scenario. If you only want `insert` events, you must pass `{operationTypes: ['insert']}`.
- Only return `_id`s for `failedDocs` and `failedDoc` in emitted events.
- Bumped dependencies.

# 0.48.0

- **Breaking Change**: When there are multiple `overrides` that match the same
  path (e.g. `*` and `foo.*` both match the path `foo.bar`), they will now be
  applied in sequence, where the output of each override is passed as input to
  the next.
- Added a `mapSchema` option as an "escape hatch" to allow preprocessing each
  node in the input object (using `map` from `obj-walker`) before converting
  it to a Crate schema.

# 0.47.0

- **Breaking Change**: Default to dynamic object policy in `convertSchema`. See docs on `strictMode` option.
- Added `failedRecords` to `process` event and `failedRecord` to `error` for changestream events where applicable.
- Added `options.mapper` to `initSync`.

# 0.46.0

- Bump packages, including latest `prom-utils` which allows for throttling of items/sec and bytes/sec.

# 0.45.0

- Latest `mongochangestream`

# 0.44.0

- Latest `mongochangestream` - Fixed omit bugs.
- Bumped peer dependencies for `ioredis` and `mongodb`.

# 0.43.0

- Latest `mongochangestream`

# 0.42.1

- Latest `mongochangestream` - Fix issue where omitting nested paths failed to remove the field from `updateDescription.updatedFields` do to dotted field name.

# 0.42.0

- Added `operationCounts` to the `process` event.

# 0.41.0

- Removed `options.mapper` in favor of `options.rename` which takes an object of dotted path to renamed dotted path.
  The `rename` option is available for syncing and converting a schema to a table.

# 0.40.0

- Latest `mongochangestream` - Change stream option `operationTypes` (`insert`, `update`, `delete`, ...).

# 0.39.0

- Use bulk insert for immutable collections.

# 0.38.0

- Latest `mongochangestream` - supports batching for change stream events.
  `mongo2crate` does not support this functionality, however.

# 0.37.0

- Latest `mongochangestream` - More robust error code handling for `missingOplogEntry`.

# 0.36.0

- Latest `mongochangestream` - Don't emit the `cursorError` event when stopping.

# 0.35.1

- Latest `mongochangestream` - FSM bug fix.

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
