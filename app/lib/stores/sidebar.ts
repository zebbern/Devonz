import { atom } from 'nanostores';

// Store to manage sidebar open/closed state
export const sidebarStore = {
  open: atom(false),

  toggle() {
    this.open.set(!this.open.get());
  },

  setOpen(value: boolean) {
    this.open.set(value);
  },
};
