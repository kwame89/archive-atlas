import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./lib/AuthProvider";
import { supabase } from "./lib/supabaseClient";
import { getMyProfile } from "./lib/profiles";
import { SignInPage } from "./pages/SignInPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import type { Profile } from "./types/database";
import "./App.css";

function AppContent() {
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    getMyProfile(session.user.id)
      .then(setProfile)
      .finally(() => setProfileLoading(false));
  }, [session]);

  if (loading || (session && profileLoading)) {
    return (
      <div className="card">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <SignInPage />;
  }

  if (!profile) {
    return <OnboardingPage authUserId={session.user.id} onComplete={setProfile} />;
  }

  return (
    <div className="card">
      <h1>Welcome, {profile.display_name}</h1>
      <p className="muted">
        {profile.type} · {profile.trust_tier}
      </p>
      <button className="secondary" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
