import { atom } from 'nanostores';

interface Profile {
  username: string;
  name: string;
  email: string;
  bio: string;
  avatar: string;
}

// Initialize with stored profile or defaults
const storedProfile = typeof window !== 'undefined' ? localStorage.getItem('devonz_profile') : null;
let initialProfile: Profile;

if (storedProfile) {
  try {
    initialProfile = JSON.parse(storedProfile);
  } catch {
    initialProfile = { username: '', name: '', email: '', bio: '', avatar: '' };
  }
} else {
  initialProfile = { username: '', name: '', email: '', bio: '', avatar: '' };
}

export const profileStore = atom<Profile>(initialProfile);

export const updateProfile = (updates: Partial<Profile>) => {
  profileStore.set({ ...profileStore.get(), ...updates });

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('devonz_profile', JSON.stringify(profileStore.get()));
  }
};
