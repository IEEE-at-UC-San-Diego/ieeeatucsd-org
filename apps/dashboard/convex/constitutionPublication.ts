export function constitutionsToArchive<T extends { _id: string }>(
  published: T[],
  publishingId: string,
): T[] {
  return published.filter((row) => row._id !== publishingId);
}
