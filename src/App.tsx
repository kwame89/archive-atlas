import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthProvider";
import { getMyProfile } from "./lib/profiles";
import { SignInPage } from "./pages/SignInPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { HomePage } from "./pages/HomePage";
import { CreateArtworkPage } from "./pages/CreateArtworkPage";
import { ArtworkPage } from "./pages/ArtworkPage";
import { ArtworkPrintPage } from "./pages/ArtworkPrintPage";
import type { Profile } from "./types/database";
import "./App.css";

function RequireProfile({ children }: { children: (profile: Profile) => ReactNode }) {
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

  return <>{children(profile)}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/artworks/:id" element={<ArtworkPage />} />
          <Route path="/artworks/:id/print" element={<ArtworkPrintPage />} />
          <Route
            path="/artworks/new"
            element={<RequireProfile>{(profile) => <CreateArtworkPage profile={profile} />}</RequireProfile>}
          />
          <Route
            path="/"
            element={<RequireProfile>{(profile) => <HomePage profile={profile} />}</RequireProfile>}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
