export const renameKey = (
  obj: Record<string, any>,
  key: string,
  newKey: string
) => {
  obj[newKey] = obj[key]
  delete obj[key]
}
