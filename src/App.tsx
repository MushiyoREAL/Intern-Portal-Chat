import { useState } from 'react';
import { App as SendbirdApp } from '@sendbird/uikit-react';
import '@sendbird/uikit-react/dist/index.css';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userId, setUserId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('');
    const [loginError, setLoginError] = useState('');

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, userType }),
            });

            if (response.ok) {
                const data = await response.json();
                setIsAuthenticated(true);
                setUserId(data.userId);
                setAccessToken(data.accessToken);
            } else {
                const error = await response.json();
                setLoginError(error.error || 'Login failed.');
            }
        } catch (error) {
            setLoginError('An error occurred during login.');
        }
    };

    if (!isAuthenticated) {
        return (
            <div>
                <h1>Login</h1>
                <form onSubmit={handleLogin}>
                    <label>
                        Email: <input value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <label>
                        Password: <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </label>
                    <label>
                        User Type:
                        <select value={userType} onChange={(e) => setUserType(e.target.value)}>
                            <option value="school">School</option>
                            <option value="company">Company</option>
                            <option value="intern">Intern</option>
                        </select>
                    </label>
                    <button type="submit">Login</button>
                </form>
                {loginError && <p>{loginError}</p>}
            </div>
        );
    }

    return (
        <div style={{ height: '100vh' }}>
            <SendbirdApp
                appId={import.meta.env.VITE_SENDBIRD_APP_ID}
                userId={userId}
                accessToken={accessToken}
            />
        </div>
    );
}

export default App;
