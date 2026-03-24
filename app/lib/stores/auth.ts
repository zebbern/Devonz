import { atom } from 'nanostores';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
}

export const authStore = atom<AuthState>({
    user: null,
    session: null,
    isLoading: true,
});

export function updateAuth(state: Partial<AuthState>) {
    authStore.set({
        ...authStore.get(),
        ...state,
    });
}

export function clearAuth() {
    authStore.set({
        user: null,
        session: null,
        isLoading: false,
    });
}
