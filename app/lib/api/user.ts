import { supabase } from '../supabase.client';

export interface UserProfile {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    website?: string;
    updated_at?: string;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No profile found
                return null;
            }
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
}

export async function updateProfile(profile: UserProfile): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                ...profile,
                updated_at: new Date().toISOString(),
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, error };
    }
}

export async function createInitialProfile(userId: string, email: string): Promise<void> {
    const username = email.split('@')[0];
    await updateProfile({
        id: userId,
        username,
        full_name: username,
    });
}
