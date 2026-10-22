import { Routes, Route, Link, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Register from './pages/Register';
import TournamentList from './pages/TournamentList';
import CreateTournament from './pages/CreateTournament';
import TournamentDetail from './pages/TournamentDetail';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Versus from './pages/Versus';

function RequireAuth({ children }) {
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="max-w-md mx-auto mt-16 p-6 text-center">
      <h1 className="text-xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-gray-500 mb-4">That page doesn't exist.</p>
      <Link to="/" className="text-sm text-blue-600">← Back to tournaments</Link>
    </div>
  );
}

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<TournamentList />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/tournaments/new"
          element={
            <RequireAuth>
              <CreateTournament />
            </RequireAuth>
          }
        />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/users/:id" element={<Profile />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/versus" element={<Versus />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;