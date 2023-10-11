import type {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
  Document,
} from 'mongodb';
import type { Redis } from 'ioredis';
import mongoChangeStream, {
  ScanOptions,
  ChangeStreamOptions,
} from 'mongochangestream';
import _ from 'lodash/fp.js';
import { Crate, ErrorResult, QueryResult } from './crate.js';
import { renameKeys, setDefaults, sumByRowcount } from './util.js';
import {
  ConvertOptions,
  SyncOptions,
  Events,
  ImmutableOption,
} from './types.js';
import { convertSchema } from './convertSchema.js';
import _debug from 'debug';

const debug = _debug('mongo2crate:sync');
import 'dotenv/config'; // Load environment variables

/**
 * Initializes synchronization between MongoDB and CrateDB.
 * @param {Redis} redis - Redis instance for synchronization.
 * @param {Collection} collection - MongoDB collection to synchronize from.
 * @param {Crate} crate - CrateDB instance to synchronize to.
 * @param {SyncOptions & mongoChangeStream.SyncOptions} options - Synchronization options.
 * @return {object} A set of synchronization functions and properties.
 */

export const initSync = (
  redis: Redis,
  collection: Collection,
  crate: Crate,
  options: SyncOptions & mongoChangeStream.SyncOptions = {}
) => {
  const mapper = (doc: Document) =>
    renameKeys(doc, { ...options.rename, _id: 'id' }); // Remap '_id' to 'id' by default

  // Default schema and table names
  const schemaName = options.schemaName || process.env.SCHEMA_NAME || 'doc';
  const tableName = options.tableName || process.env.TABLE_NAME || collection.collectionName.toLowerCase();
  const qualifiedName = `"${schemaName}"."${tableName}"`;


  // Initialize sync with MongoDB using mongoChangeStream
  const sync = mongoChangeStream.initSync<Events>(redis, collection, options);
  const emitter = sync.emitter;

  // Emit event wrapper
  const emit = (event: Events, data: object) => {
    emitter.emit(event, { type: event, ...data });
  };

    /**
   * Converts a MongoDB JSON schema to a CrateDB table definition.
   * @param {object} jsonSchema - The MongoDB JSON schema to convert.
   * @param {ConvertOptions} opts - Options for the conversion.
   * @return {Promise<QueryResult | ErrorResult>} Response from the CrateDB after executing the create table statement.
   */
  const createTableFromSchema = async (
    jsonSchema: object,
    opts: ConvertOptions = {}
  ) => {
    const createTableStmt = convertSchema(jsonSchema, qualifiedName, {
      omit: opts.omit,
      ...opts,
    });
    return crate.query(createTableStmt);
  };

    /**
   * Handles the result from a change stream event.
   * @param {QueryResult | ErrorResult} result - Result from the CrateDB after processing the change.
   */
  const handleResult = (result: QueryResult | ErrorResult) => {
    debug('Change stream result %O', result);
    if ('rowcount' in result) {
      emit('process', { success: result.rowcount, changeStream: true });
    } else {
      emit('error', { error: result, changeStream: true });
    }
  };

  /**
   * Processes records from a change stream event based on their operation type.
   * @param {ChangeStreamDocument[]} docs - Documents from the change stream event.
   */
  const processChangeStreamRecords = async (docs: ChangeStreamDocument[]) => {
    const doc = docs[0];
    try {
      const { operationType, fullDocument, updateDescription, documentKey } = doc;

      if (operationType === 'insert') {
        const document = mapper(fullDocument);
        handleResult(await crate.insert(qualifiedName, document));
      } else if (operationType === 'update') {
        const { updatedFields, removedFields } = updateDescription;
        const update = mapper({ ...updatedFields, ...setDefaults(removedFields, null) });
        if (_.size(update)) {
          const document = fullDocument ? mapper(fullDocument) : {};
          handleResult(await crate.upsert(qualifiedName, document, update));
        }
      } else if (operationType === 'replace' || operationType === 'delete') {
        const id = documentKey._id.toString();
        if (operationType === 'replace') {
          await crate.deleteById(qualifiedName, id);
          handleResult(await crate.insert(qualifiedName, mapper(fullDocument)));
        } else {
          handleResult(await crate.deleteById(qualifiedName, id));
        }
      }
    } catch (e) {
      emit('error', { error: e, changeStream: true });
    }
  };

    /**
   * Processes bulk insertion of records to CrateDB.
   * @param {ChangeStreamInsertDocument[]} docs - Documents to insert.
   * @param {string} type - The type of insertion, defaults to 'initialScan'.
   */
  const processInsertRecords = async (
    docs: ChangeStreamInsertDocument[],
    type = 'initialScan'
  ) => {
    try {
      const documents = docs.map(({ fullDocument }) => mapper(fullDocument));
      const result = await crate.bulkInsert(qualifiedName, documents);
      debug('Bulk insert result %O', result);
      if ('results' in result) {
        const numInserted = sumByRowcount(1)(result.results);
        const numFailed = sumByRowcount(-2)(result.results);
        emit('process', {
          success: numInserted,
          fail: numFailed,
          [type]: true,
        });
      } else if ('error' in result) {
        emit('error', { error: result, [type]: true });
      }
    } catch (e) {
      emit('error', { error: e, [type]: true });
    }
  };

    /**
   * Processes records from a change stream event.
   * @param {QueueOptions & ChangeStreamOptions & ImmutableOption} opts - Options for processing the change stream.
   */
  const processChangeStream = (
    opts?: QueueOptions & ChangeStreamOptions & ImmutableOption
  ) => {
    const processFn = opts?.immutable
      ? (docs: ChangeStreamDocument[]) =>
          processInsertRecords(docs as unknown as ChangeStreamInsertDocument[], 'changeStream')
      : processChangeStreamRecords;
    const changeStreamOptions = opts?.immutable
      ? { ...opts, operationTypes: ['insert'] }
      : { ...opts, batchSize: 1 }; // Always process one record at a time

    return sync.processChangeStream(processFn, changeStreamOptions);
  };

   /**
   * Executes an initial scan of the MongoDB collection and inserts the results into CrateDB.
   * @param {QueueOptions & ScanOptions} opts - Options for the initial scan.
   */
  const runInitialScan = (opts?: QueueOptions & ScanOptions) =>
    sync.runInitialScan(processInsertRecords, opts);

  return {
    ...sync,
    processChangeStream,
    runInitialScan,
    createTableFromSchema,
    schemaName,
    tableName,
    qualifiedName,
    emitter,
  };
};
