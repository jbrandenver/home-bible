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

export function getDemoActiveProperty() {
  if (typeof window === 'undefined') {
    return null;
  }

  return parseJson<DemoProperty | null>(window.localStorage.getItem('homeBible.activeProperty'), null);
}

export function setDemoActiveProperty(property: DemoProperty) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('homeBible.activeProperty', JSON.stringify(property));
}

export function getDemoRooms() {
  if (typeof window === 'undefined') {
    return [] as DemoRoom[];
  }

  return parseJson<DemoRoom[]>(window.localStorage.getItem('homeBible.rooms'), []);
}

export function setDemoRooms(rooms: DemoRoom[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('homeBible.rooms', JSON.stringify(rooms));
}

export function getDemoCollection<T>(storageKey: string) {
  if (typeof window === 'undefined') {
    return [] as T[];
  }

  return parseJson<T[]>(window.localStorage.getItem(storageKey), []);
}
