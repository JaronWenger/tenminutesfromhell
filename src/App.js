import { AuthProvider } from './contexts/AuthContext';
import Main from './components/main';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Main />
      </div>
    </AuthProvider>
  );
}

export default App;
