// LoginForm.tsx (reworked to use AuthCard)
import React, { useState } from 'react';
import { useAuth } from "@/providers/Authcontext";
import { useNavigate } from 'react-router-dom';
import AuthCard, { LoginPayload, RegisterPayload } from './authcard';
import { api } from '@/backend/api';

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
        } catch (err: any) {
            if (err.code) {
                switch (err.code) {
                    case "INVALID_EMAIL":
                        return setToast({ type: 'danger', text: 'Diese Email existiert nicht.' });
                    case "INVALID_NAME":
                        return setToast({ type: 'danger', text: 'Diesen Mitarbeiter gibt es nicht.' });
                    case "INVALID_PASSWORD":
                        return setToast({ type: 'danger', text: 'Passwort ist falsch.' });
                    case "NOT_APPROVED":
                        return setToast({ type: 'danger', text: 'Ihr Account wurde noch nicht freigeschaltet.' });
                    case "MISSING_FIELDS":
                        return setToast({ type: 'danger', text: 'Bitte alle Felder ausfüllen.' });
                    default:
                        return setToast({ type: 'danger', text: err.message || 'Unbekannter Fehler.' });
                }
            }

            setToast({ type: 'danger', text: 'Login fehlgeschlagen.' });
        }
    };

    const handleRegister = async (data: RegisterPayload) => {
        // Map all fields from RegisterPayload to your Kunde model.
        const kundeToSend: any = {
            // Basis
            name: data.name,
            email: data.email,
            password: data.password,
            telefon: data.telefon,
            adresse: data.adresse,

            // Firmendaten
            ustId: data.ustId,
            handelsregisterNr: data.handelsregisterNr,
            ansprechpartner: data.ansprechpartner,
            website: data.website,

            // Lieferzeit (Zeitfenster als String)
            lieferzeit: data.lieferzeit,

            // Dateien
            gewerbeDateiUrl: data.gewerbeDateiUrl,
            zusatzDateiUrl: data.zusatzDateiUrl,

            // Belegversand (Workflows)
            emailRechnung: data.emailRechnung,
            emailLieferschein: data.emailLieferschein,
            emailBuchhaltung: data.emailBuchhaltung,
            emailSpedition: data.emailSpedition,
        };

        try {
            await api.createKunde(kundeToSend);
            setToast({ type: 'success', text: 'Registrierung erfolgreich. Bitte warten Sie auf Ihre Aktivierung.' });
        } catch (err: any) {
            if (err?.code) {
                switch (err.code) {
                    case 'EMAIL_ALREADY_EXISTS':
                        return setToast({ type: 'danger', text: 'Diese E‑Mail ist bereits registriert.' });
                    case 'MISSING_FIELDS':
                        return setToast({ type: 'danger', text: 'Bitte alle Pflichtfelder ausfüllen.' });
                    default:
                        return setToast({ type: 'danger', text: err.message || 'Registrierung fehlgeschlagen.' });
                }
            }
            setToast({ type: 'danger', text: err?.message || 'Registrierung fehlgeschlagen.' });
        }
    };

    return (
        <>
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="row w-100 align-items-center justify-content-center">
                    <div className="col-12 col-lg-11 col-xl-10 py-4">
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