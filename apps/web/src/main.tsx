import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { TTSProvider } from './context/TTSContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { BooksProvider } from './context/BooksContext'
import App from './App'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY - auth features disabled')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY || ''}>
      <TTSProvider>
        <PreferencesProvider>
          <WorkspaceProvider>
            <OnboardingProvider>
              <BooksProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </BooksProvider>
            </OnboardingProvider>
          </WorkspaceProvider>
        </PreferencesProvider>
      </TTSProvider>
    </ClerkProvider>
  </React.StrictMode>,
)
