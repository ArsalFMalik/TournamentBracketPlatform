import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

function readUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
}

const linkClass = ({ isActive }) => `text-sm ${isActive ? 'font-semibold text-blue-700' : 'text-gray-600 hover:text-gray-900'}`;

export default function NavBar() {
    useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const user = readUser();
    const loggedIn = !!localStorage.getItem('token') && !!user;

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        queryClient.clear();
    }

    return (
        <header className="border-b bg-white">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
                <Link to="/" className="font-bold">Tournament Manager</Link>
                <nav className="flex items-center gap-4">
                    <NavLink to="/" end className={linkClass}>Tournaments</NavLink>
                    <NavLink to="/analytics" className={linkClass}>Analytics</NavLink>
                    <NavLink to="/versus" className={linkClass}>Head-to-head</NavLink>
                </nav>
                <div className="ml-auto flex items-center gap-4">
                    {loggedIn ? (
                        <>
                            <Link to={`/users/${user.id}`} className="text-sm text-gray-600 hover:text-gray-900">
                                {user.username}
                            </Link>
                            <button onClick={logout} className="text-sm border px-2 py-1 rounded hover:bg-gray-50">
                                Log out
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/login" className={linkClass}>Log in</NavLink>
                            <NavLink to="/register" className={linkClass}>Register</NavLink>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}