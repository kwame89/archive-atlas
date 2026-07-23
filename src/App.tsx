import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToHash } from "./components/ScrollToHash";
import { AuthProvider } from "./lib/AuthProvider";
import { useAuth } from "./lib/authContext";
import { getMyProfile } from "./lib/profiles";
import { SignInPage } from "./pages/SignInPage";
import { LandingPage } from "./pages/LandingPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { HomePage } from "./pages/HomePage";
import { CreateArtworkPage } from "./pages/CreateArtworkPage";
import { BatchArtworkPage } from "./pages/BatchArtworkPage";
import { EditArtworkPage } from "./pages/EditArtworkPage";
import { ArtworkPage } from "./pages/ArtworkPage";
import { ArtworkPrintPage } from "./pages/ArtworkPrintPage";
import { CertificatePage } from "./pages/CertificatePage";
import { CertificateVerificationPage } from "./pages/CertificateVerificationPage";
import { CatalogPrintPage } from "./pages/CatalogPrintPage";
import { CollectiveDashboardPage } from "./pages/CollectiveDashboardPage";
import { MyExhibitionsPage } from "./pages/MyExhibitionsPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { DirectoryPage } from "./pages/DirectoryPage";
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
  const authUserId = session?.user.id ?? null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!authUserId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    getMyProfile(authUserId)
      .then(setProfile)
      .finally(() => setProfileLoading(false));
  }, [authUserId]);

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
        <ScrollToHash />
        <Routes>
          <Route
            path="/artworks/:id/edit"
            element={
              <RequireProfile>{(profile) => <EditArtworkPage profile={profile} />}</RequireProfile>
            }
          />
          <Route path="/artworks/:id" element={<ArtworkPage />} />
          <Route path="/profiles/:id" element={<ProfilePage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/artworks/:id/print" element={<ArtworkPrintPage />} />
          <Route
            path="/artworks/:id/certificate"
            element={
              <RequireProfile>{(profile) => <CertificatePage profile={profile} />}</RequireProfile>
            }
          />
          <Route path="/verify/:code" element={<CertificateVerificationPage />} />
          <Route path="/catalog/print" element={<CatalogPrintPage />} />
          <Route
            path="/artworks/new"
            element={<RequireProfile>{(profile) => <CreateArtworkPage profile={profile} />}</RequireProfile>}
          />
          <Route
            path="/artworks/batch"
            element={
              <RequireProfile>{(profile) => <BatchArtworkPage profile={profile} />}</RequireProfile>
            }
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
            path="/collections"
            element={
              <RequireProfile>{(profile) => <CollectionsPage profile={profile} />}</RequireProfile>
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
