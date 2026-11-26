import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App.jsx';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import RootErrorBoundary from './shared/RootErrorBoundary.jsx';
import './index.css';
import './shared/styles/theme.css';

const container = document.getElementById('root');

function renderApp() {
  let root = container._petcareRoot;
  if (!root) {
    root = createRoot(container);
    container._petcareRoot = root;
  }
  root.render(
    <StrictMode>
      <RootErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </RootErrorBoundary>
    </StrictMode>,
  );
}

renderApp();

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    renderApp();
  });
}