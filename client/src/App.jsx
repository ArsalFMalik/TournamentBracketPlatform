import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import TournamentList from './pages/TournamentList';
import CreateTournament from './pages/CreateTournament';
import TournamentDetail from './pages/TournamentDetail';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Versus from './pages/Versus';

function App() {
  return (
    <Routes>
      <Route path="/" element={<TournamentList />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/tournaments/new" element={<CreateTournament />} />
      <Route path="/tournaments/:id" element={<TournamentDetail />} />
      <Route path="/users/:id" element={<Profile />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/versus" element={<Versus />} />
    </Routes>
  );
}

export default App;