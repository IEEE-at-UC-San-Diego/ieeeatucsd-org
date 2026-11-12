/**
 * Append a storage id onto an event's current graphics files.
 * Callers must pass the list just read from the document so two uploads
 * cannot replace each other's attachments.
 */
export class EventGraphicsFiles {
  static append(
    current: readonly string[] | null | undefined,
    storageId: string,
  ): string[] {
    const id = storageId.trim();
    if (!id) {
      throw new Error("Storage file is missing");
    }
    const existing = current ?? [];
    if (existing.includes(id)) return [...existing];
    return [...existing, id];
  }
}
