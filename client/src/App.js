import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Main from './components/Main';
import './App.css';

function App() {
  return (
    <UserProvider>
      <Router>
        <div className="App">
          <Main />
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;