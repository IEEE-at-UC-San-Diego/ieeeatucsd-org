import type { EventStorageInvoice, EventStorageSource } from "./eventStorageAccess";

/**
 * Storage ids written by `events.create` and `events.update`.
 * External links are not storage ids and stay pasteable.
 */
export type EventStorageWrite = {
  files?: readonly string[] | null;
  roomBookingFiles?: readonly string[] | null;
  graphicsFiles?: readonly string[] | null;
  invoices?: readonly EventStorageInvoice[] | null;
};

export class EventStorageAttachment {
  static isStorageId(value: string): boolean {
    return !/^(https?:|data:)/i.test(value);
  }

  /**
   * Ids in `next` that are not already stored on `current`. Blank storage
   * ids in the write are rejected. Ids already on the event are left alone
   * so an edit can resend them.
   */
  static addedIds(
    current: EventStorageWrite | EventStorageSource | null | undefined,
    next: EventStorageWrite | null | undefined,
  ): string[] {
    const existing = new Set<string>();
    EventStorageAttachment.visit(current, (raw) => {
      if (typeof raw !== "string") return;
      const id = raw.trim();
      if (id && EventStorageAttachment.isStorageId(id)) existing.add(id);
    });

    const added: string[] = [];
    EventStorageAttachment.visit(next, (raw) => {
      if (typeof raw !== "string") {
        throw new Error("Storage file is missing");
      }
      const id = raw.trim();
      if (!id) throw new Error("Storage file is missing");
      if (!EventStorageAttachment.isStorageId(id)) return;
      if (!existing.has(id) && !added.includes(id)) added.push(id);
    });
    return added;
  }

  private static visit(
    source: EventStorageWrite | EventStorageSource | null | undefined,
    visit: (value: string) => void,
  ) {
    if (!source) return;
    const add = (value: string | null | undefined) => {
      if (typeof value !== "string") return;
      visit(value);
    };
    for (const id of source.files ?? []) add(id);
    for (const id of source.roomBookingFiles ?? []) add(id);
    for (const id of source.graphicsFiles ?? []) add(id);
    for (const invoice of source.invoices ?? []) {
      add(invoice?.invoiceFile);
      for (const id of invoice?.additionalFiles ?? []) add(id);
    }
  }
}
