
import { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

const getStoredUser = () => {
    const storedUser = localStorage.getItem('pos-user');

    if (!storedUser) {
        return null;
    }

    try {
        const user = JSON.parse(storedUser);

        if (user && typeof user === 'object' && !Array.isArray(user)) {
            return user;
        }
    } catch (error) {
        console.error('Stored user data is invalid.', error);
    }

    localStorage.removeItem('pos-user');
    localStorage.removeItem('pos-token');
    return null;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(getStoredUser);

    const login = (userData, token) => {
        setUser(userData);
        localStorage.setItem('pos-user', JSON.stringify(userData));
        localStorage.setItem('pos-token', token);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('pos-user');
        localStorage.removeItem('pos-token');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};

export default AuthProvider;
