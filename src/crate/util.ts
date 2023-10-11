import _ from 'lodash/fp.js';
import { setDefaults } from '../util.js';

// -------------- General Helpers ----------------

/**
 * Appends a query parameter for column types if required.
 * @param {string} endpoint - The base SQL endpoint URL.
 * @param {boolean} coltypes - If true, appends the types query parameter.
 * @return {string} The modified endpoint URL.
 */
export const maybeShowColTypes = (endpoint: string, coltypes: boolean) =>
  coltypes ? `${endpoint}?types` : endpoint;

/**
 * Encodes authentication details for a request header.
 * @param {string} auth - Authentication details, typically in "username:password" format.
 * @return {object} A header object with the encoded authorization details.
 */
export const getAuthHeader = (auth: string) => ({
  Authorization: 'Basic ' + Buffer.from(auth, 'binary').toString('base64'),
});

// -------------- SQL Manipulations --------------

/**
 * Extracts unique top-level keys from an array of records.
 * @param {object[]} records - Array of record objects.
 * @return {string[]} Array of unique keys.
 */
export const getUniqueKeys = (records: object[]) => {
  const keys = new Set<string>();
  records.forEach((rec) => Object.keys(rec).forEach((key) => keys.add(key)));
  return Array.from(keys).sort();
};

/**
 * Quotes a given SQL column name, taking into account nested properties.
 * @param {string} column - Column name possibly with dots indicating nesting.
 * @return {string} The quoted column name.
 */
export const quoteColumn = (column: string) => {
  const [first, ...rest] = column.split('.');
  return rest.reduce((acc, inner) => acc + `['${inner}']`, `"${first}"`);
};

/**
 * Produces SQL column definitions and placeholders for insertion.
 * @param {string[]} fields - List of column names.
 * @return {object} An object containing the comma-separated column names and corresponding placeholders.
 */
export const getInsertColsAndPlaceholders = (fields: string[]) => {
  const columns = fields.map((col) => `"${col}"`).join(',');
  const placeholders = _.repeat(fields.length - 1, '?,') + '?';
  return { columns, placeholders };
};

/**
 * Generates SQL assignments and values for updates.
 * @param {object} record - The original record.
 * @param {object} update - The update instructions.
 * @return {object} An object containing the SQL assignments and the update values.
 */
export const getAssignmentsAndUpdates = (record: Record<string, any>, update: Record<string, any>) => {
  const placeholders = Object.keys(update).map(column => {
    if (/\.[0-9]+/.test(column)) {
      const [first] = column.split('.');
      return `${quoteColumn(first)} = ?`;
    }
    return `${quoteColumn(column)} = ?`;
  });
  
  const updates = Object.keys(update).map(column => {
    if (/\.[0-9]+/.test(column)) {
      const [first] = column.split('.');
      return record[first];
    }
    return update[column];
  });

  return { assignments: placeholders.join(','), updates };
};

// -------------- SQL Creators ----------------

/**
 * Generates SQL and arguments for record insertion.
 * @param {string} qualifiedName - Full table name.
 * @param {object} record - Record to insert.
 * @return {object} An object containing the insertion SQL and corresponding argument values.
 */
export const getInsertSqlAndArgs = (qualifiedName: string, record: object) => {
  const { columns, placeholders } = getInsertColsAndPlaceholders(Object.keys(record));
  return {
    sql: `INSERT INTO ${qualifiedName} (${columns}) VALUES (${placeholders})`,
    args: Object.values(record)
  };
};

/**
 * Generates SQL and arguments for record deletion by ID.
 * @param {string} qualifiedName - Full table name.
 * @param {string} id - Record ID to delete.
 * @return {object} An object containing the deletion SQL and corresponding argument values.
 */
export const getDeleteByIdSqlAndArgs = (qualifiedName: string, id: string) => ({
  sql: `DELETE FROM ${qualifiedName} WHERE id = ?`,
  args: [id]
});

/**
 * Generates SQL and arguments for bulk record insertion.
 * @param {string} qualifiedName - Full table name.
 * @param {object[]} records - Records to insert.
 * @return {object} An object containing the bulk insertion SQL and corresponding argument values.
 */
export const getBulkInsertSqlAndArgs = (qualifiedName: string, records: object[]) => {
  const keys = getUniqueKeys(records);
  const { columns, placeholders } = getInsertColsAndPlaceholders(keys);
  const defaults = setDefaults(keys, null);
  const args = records.map(
    _.flow(_.defaults(defaults), _.toPairs, _.sortBy(_.head), _.map(_.last))
  );

  return {
    sql: `INSERT INTO ${qualifiedName} (${columns}) VALUES (${placeholders})`,
    args
  };
};


/**
 * Generates SQL and arguments for record upsert (insert or update).
 * @param {string} qualifiedName - Full table name.
 * @param {object} record - Record to upsert.
 * @param {object} update - Instructions for updates.
 * @return {object} An object containing the upsert SQL and corresponding argument values.
 */
export const getUpsertSqlAndArgs = (qualifiedName: string, record: object, update: object) => {
  const { columns, placeholders } = getInsertColsAndPlaceholders(Object.keys(record));
  const { assignments, updates } = getAssignmentsAndUpdates(record, update);

  return {
    sql: `INSERT INTO ${qualifiedName} (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${assignments}`,
    args: [...Object.values(record), ...updates]
  };
};
