import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthProvider";
import { getMyProfile } from "./lib/profiles";
import { SignInPage } from "./pages/SignInPage";
import { LandingPage } from "./pages/LandingPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { HomePage } from "./pages/HomePage";
import { CreateArtworkPage } from "./pages/CreateArtworkPage";
import { ArtworkPage } from "./pages/ArtworkPage";
import { ArtworkPrintPage } from "./pages/ArtworkPrintPage";
import { CatalogPrintPage } from "./pages/CatalogPrintPage";
import { CollectiveDashboardPage } from "./pages/CollectiveDashboardPage";
import { MyExhibitionsPage } from "./pages/MyExhibitionsPage";
import { ProfilePage } from "./pages/ProfilePage";
import type { Profile } from "./types/database";
import "./App.css";

function RequireProfile({
  children,
  loggedOutFallback = <SignInPage />,
}: {
  children: (profile: Profile) => ReactNode;
  loggedOutFallback?: ReactNode;
}) {
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
    return <>{loggedOutFallback}</>;
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
          <Route path="/profiles/:id" element={<ProfilePage />} />
          <Route path="/artworks/:id/print" element={<ArtworkPrintPage />} />
          <Route path="/catalog/print" element={<CatalogPrintPage />} />
          <Route
            path="/artworks/new"
            element={<RequireProfile>{(profile) => <CreateArtworkPage profile={profile} />}</RequireProfile>}
          />
          <Route
            path="/collective"
            element={
              <RequireProfile>{(profile) => <CollectiveDashboardPage profile={profile} />}</RequireProfile>
            }
          />
          <Route
            path="/exhibitions"
            element={
              <RequireProfile>{(profile) => <MyExhibitionsPage profile={profile} />}</RequireProfile>
            }
          />
          <Route
            path="/"
            element={
              <RequireProfile loggedOutFallback={<LandingPage />}>
                {(profile) => <HomePage profile={profile} />}
              </RequireProfile>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
