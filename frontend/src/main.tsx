import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installFetchMock } from './mock/install'

// MODO DEMO: sin backend, fetch() también se resuelve con datos simulados
installFetchMock()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

