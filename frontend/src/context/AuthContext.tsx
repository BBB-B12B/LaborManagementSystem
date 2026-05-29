import React, { createContext, useContext } from 'react';
import useAuthStore from '../store/authStore';

const AuthContext = createContext({ user: null });

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    // In our system it's typically authStore, here we just adapt it
    const { user } = useAuthStore();
    return (
        <AuthContext.Provider value={{ user: user as any }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const { user } = useAuthStore();
    return { user };
};
