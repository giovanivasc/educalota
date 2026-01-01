
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    // Monitor inactivity
    useEffect(() => {
        if (!session) return;

        const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour
        const CHECK_INTERVAL = 60 * 1000; // Check every minute
        const lastActivity = { current: Date.now() };

        const updateActivity = () => {
            lastActivity.current = Date.now();
        };

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
        events.forEach(event => window.addEventListener(event, updateActivity));

        const checkInactivity = setInterval(() => {
            if (Date.now() - lastActivity.current > INACTIVITY_LIMIT) {
                console.log('User inactive for too long. Logging out...');
                signOut();
            }
        }, CHECK_INTERVAL);

        // Initial check in case the tab was already open for a long time (though session effects trigger on mount)
        // Actually, setInterval is enough.

        return () => {
            events.forEach(event => window.removeEventListener(event, updateActivity));
            clearInterval(checkInactivity);
        };
    }, [session]);

    const value = {
        user,
        session,
        loading,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
