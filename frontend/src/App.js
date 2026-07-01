// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProjectList from './components/ProjectList';
import ProjectPage from './components/ProjectPage';
import PageDetail from './components/PageDetail';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:projectId" element={<ProjectPage />} />
        <Route path="/project/:projectId/page/:pageId" element={<PageDetail />} />
      </Routes>
    </Router>
  );
}

export default App;