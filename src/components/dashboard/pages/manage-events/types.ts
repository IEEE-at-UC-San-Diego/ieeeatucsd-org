export interface ManagedEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  capacity: number;
  status: EventStatus;
  type: string;
  organizer: string;
}

export type EventStatus = 'published' | 'draft' | 'cancelled';

export interface EventStats {
  total: number;
  published: number;
  drafts: number;
  totalAttendees: number;
}

export interface EventFilters {
  status?: EventStatus;
  type?: string;
  organizer?: string;
  searchTerm?: string;
} 