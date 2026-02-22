import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.token, data.user);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Server unreachable');
    }
  };

  const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1a1a', color: 'white', fontFamily: 'sans-serif' },
    card: { backgroundColor: '#2d2d2d', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', width: '350px' },
    input: { width: '100%', padding: '10px', margin: '10px 0', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#3d3d3d', color: 'white', boxSizing: 'border-box' },
    button: { width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    error: { color: '#ff6b6b', fontSize: '14px', marginBottom: '10px' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Mini SIEM Login</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input 
            type="text" placeholder="Username" style={styles.input} 
            value={username} onChange={(e) => setUsername(e.target.value)} required 
          />
          <input 
            type="password" placeholder="Password" style={styles.input} 
            value={password} onChange={(e) => setPassword(e.target.value)} required 
          />
          <button type="submit" style={styles.button}>Access System</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
