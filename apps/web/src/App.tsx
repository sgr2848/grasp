import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AppPage from "./pages/App";
import Learn from "./pages/Learn";
import Review from "./pages/Review";
import History from "./pages/History";
import Workspaces from "./pages/Workspaces";
import Books from "./pages/Books";
import Book from "./pages/Book";
import Reader from "./pages/Reader";
import Settings from "./pages/Settings";
import Knowledge from "./pages/Knowledge";
import Layout from "./components/Layout";
import { useAuth } from "./hooks/useAuth";

function App() {
  // Initialize auth token getter for API calls
  useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/test" element={<AppPage />} />
        <Route path="/app" element={<Learn />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:loopId" element={<Learn />} />
        <Route path="/review/:loopId" element={<Review />} />
        <Route path="/history" element={<History />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/books" element={<Books />} />
        <Route path="/books/:id" element={<Book />} />
        <Route path="/books/:bookId/read/:chapterId" element={<Reader />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
