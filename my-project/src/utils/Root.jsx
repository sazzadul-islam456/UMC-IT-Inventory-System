import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router';

const Root = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/login');
        } else if (user.role === 'admin') {
            navigate('/admin/dashboard');
        } else if (user.role === 'employee') {
            navigate('/employee/dashboard');
        } else {
            navigate('/customer/dashboard');
        }
    }, [user, navigate]);

    return null;
};

export default Root;