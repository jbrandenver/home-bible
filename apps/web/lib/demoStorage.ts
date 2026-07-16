export type DemoProperty = {
  id: string;
  nickname: string;
  property_type: string;
  created_at: string;
};

export type DemoRoom = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isDemoProperty(value: unknown): value is DemoProperty {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as DemoProperty).id === 'string' &&
      typeof (value as DemoProperty).nickname === 'string' &&
      typeof (value as DemoProperty).property_type === 'string' &&
      typeof (value as DemoProperty).created_at === 'string'
  );
}

function isDemoRoom(value: unknown): value is DemoRoom {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as DemoRoom).id === 'string' &&
      typeof (value as DemoRoom).name === 'string' &&
      typeof (value as DemoRoom).room_type === 'string' &&
      typeof (value as DemoRoom).floor_name === 'string'
  );
}

export function getDemoActiveProperty() {
  if (typeof window === 'undefined') {
    return null;
  }

  const parsed = parseJson<unknown>(window.localStorage.getItem('homeFolder.activeProperty'), null);
  return isDemoProperty(parsed) ? parsed : null;
}

export function setDemoActiveProperty(property: DemoProperty) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('homeFolder.activeProperty', JSON.stringify(property));
}

export function getDemoRooms() {
  if (typeof window === 'undefined') {
    return [] as DemoRoom[];
  }

  const parsed = parseJson<unknown>(window.localStorage.getItem('homeFolder.rooms'), []);
  return Array.isArray(parsed) ? parsed.filter(isDemoRoom) : [];
}

export function setDemoRooms(rooms: DemoRoom[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('homeFolder.rooms', JSON.stringify(rooms));
}

export function getDemoCollection<T>(storageKey: string) {
  if (typeof window === 'undefined') {
    return [] as T[];
  }

  const parsed = parseJson<unknown>(window.localStorage.getItem(storageKey), []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}
