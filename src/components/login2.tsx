// LoginForm.tsx (reworked to use AuthCard)
import React, { useState } from 'react';
import { useAuth } from '../providers/Authcontext';
import { useNavigate } from 'react-router-dom';
import coverImg from '../assets/hijab.png';
import AuthCard, { LoginPayload, RegisterPayload } from './authcard';
import { api } from '../backend/api';

const Login2Form: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [toast, setToast] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

    const handleLogin = async ({ identifier, password }: LoginPayload) => {
        const loginObj: { email?: string; name?: string; password: string } = { password };

        if (identifier.includes('@')) {
            loginObj.email = identifier;
        } else {
            loginObj.name = identifier;
        }

        try {
            await login(loginObj);
            setToast({ type: 'success', text: 'Login erfolgreich.' });
            navigate('/home');
        } catch {
            setToast({ type: 'danger', text: 'Login fehlgeschlagen.' });
        }
    };

    const handleRegister = async (data: RegisterPayload) => {
        // Map all fields from RegisterPayload to your Kunde model.
        const kundeToSend: any = {
            name: data.name,
            email: data.email,
            password: data.password,
            telefon: data.phone,
            adresse: data.adresse,
            lieferzeit: data.lieferzeit,
            ustId: data.ustId,
            handelsregisterNr: data.handelsregisterNr,
            ansprechpartner: data.ansprechpartner,
            website: data.website,
        };

        try {
            await api.createKunde(kundeToSend);
            setToast({ type: 'success', text: 'Registrierung erfolgreich. Bitte warten Sie auf Ihre Aktivierung.' });
            // After successful registration, switch to login UX by navigating back to this page
            // (AuthCard shows a success internally, but we keep the simple flow and return to login)
        } catch {
            setToast({ type: 'danger', text: 'Registrierung fehlgeschlagen.' });
        }
    };

    return (
        <>
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="row w-100 align-items-center justify-content-center">
                    <div className="col-12 col-xl-6 py-4">
                        <AuthCard
                            brandName="Hacilar"
                            accentColor="#3edbb7"
                            onLogin={handleLogin}
                            onRegister={async (payload) => {
                                await handleRegister(payload);
                                // Pre-fill email back on the login tab is handled by AuthCard; keep user on same page
                            }}
                            defaultTab="login"
                        />
                    </div>
                </div>
            </div>
            <div className="toast-container position-fixed bottom-0 end-0 p-3">
                {toast && (
                    <div className={`toast show text-white bg-${toast.type}`} role="alert" aria-live="assertive" aria-atomic="true">
                        <div className="d-flex">
                            <div className="toast-body">{toast.text}</div>
                            <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)}></button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Login2Form;