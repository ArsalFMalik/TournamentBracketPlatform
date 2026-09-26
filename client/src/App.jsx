import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import TournamentList from './pages/TournamentList';
import CreateTournament from './pages/CreateTournament';
import TournamentDetail from './pages/TournamentDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<TournamentList />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/tournaments/new" element={<CreateTournament />} />
      <Route path="/tournaments/:id" element={<TournamentDetail />} />
    </Routes>
  );
}

export default App;