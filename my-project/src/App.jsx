import {
    BrowserRouter as Router,
    Routes,
    Route
} from 'react-router';

import Login from './pages/Login.jsx';
import './App.css';
import Root from './utils/Root.jsx';
import ProtectedRoutes from './utils/ProtectedRoutes.jsx';
import Dashboard from './pages/Admin/Dashboard.jsx';

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Root />} />
                <Route path="/login" element={<Login />} />

                <Route path="/admin/dashboard" element={<ProtectedRoutes requireRole={['admin']}> <Dashboard /> </ProtectedRoutes>} />

                <Route path="/employee/dashboard" element={<ProtectedRoutes requireRole={['employee']}> <h1>Employee Dashboard</h1> </ProtectedRoutes>} />

                <Route path="/customer/dashboard" element={<h1>Customer Dashboard</h1>} />

                <Route path="/unauthorized" element={<p className=" font-bold text-3xl mt-20 ml-20">Unauthorized</p>} />
            </Routes>
        </Router>
    );
};

export default App;