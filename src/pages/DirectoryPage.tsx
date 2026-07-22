import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, MapPin, Search, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../lib/authContext";
import { getMyProfile, listPublicProfiles } from "../lib/profiles";
import { PROFILE_TYPE_LABELS, PROFILE_TYPE_OPTIONS } from "../lib/profilePresentation";
import { profilePath } from "../lib/recordRoutes";
import { getErrorMessage } from "../lib/errors";
import type { Profile, ProfileType } from "../types/database";

type DirectoryFilter = "all" | ProfileType;

function profileSearchText(profile: Profile): string {
  return [
    profile.display_name,
    profile.headline,
    profile.location,
    profile.bio,
    ...(profile.specialties ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function DirectoryPage() {
  const { session } = useAuth();
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DirectoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      listPublicProfiles(),
      session ? getMyProfile(session.user.id) : Promise.resolve(null),
    ])
      .then(([publicProfiles, mine]) => {
        setProfiles(publicProfiles);
        setMyProfile(mine);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [session]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (typeFilter !== "all" && profile.type !== typeFilter) return false;
      return !normalizedQuery || profileSearchText(profile).includes(normalizedQuery);
    });
  }, [profiles, query, typeFilter]);

  return (
    <div className="page-wide directory-page">
      <AppHeader profile={myProfile} />

      <main>
        <section className="directory-intro">
          <div>
            <p className="eyebrow">Archive Atlas network</p>
            <h1>Find the people and places behind the work.</h1>
          </div>
          <p>
            Discover public profiles across the archive: artists, curators, galleries,
            collectives, collectors, and cultural institutions.
          </p>
        </section>

        <section className="directory-controls" aria-label="Profile directory filters">
          <label className="directory-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search public profiles</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search names, locations, or specialties"
            />
          </label>
          <label className="directory-type-filter">
            <span>Account type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as DirectoryFilter)}
            >
              <option value="all">All public profiles</option>
              {PROFILE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <div className="directory-results-heading">
          <div>
            <p className="eyebrow">Public directory</p>
            <h2>{query || typeFilter !== "all" ? "Matching profiles" : "The community"}</h2>
          </div>
          <span>{filteredProfiles.length} profiles</span>
        </div>

        {loading && <p className="directory-status">Loading public profiles…</p>}
        {error && <p className="error directory-status">{error}</p>}
        {!loading && !error && filteredProfiles.length === 0 && (
          <div className="directory-empty">
            <UsersRound size={28} strokeWidth={1.5} aria-hidden="true" />
            <h2>No public profiles match yet.</h2>
            <p>Try a broader search or a different account type.</p>
          </div>
        )}

        {!loading && !error && filteredProfiles.length > 0 && (
          <ul className="directory-grid">
            {filteredProfiles.map((profile) => (
              <li key={profile.id}>
                <Link to={profilePath(profile)}>
                  <div className="directory-card-topline">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="directory-avatar" />
                    ) : (
                      <span className="directory-avatar directory-avatar-placeholder" aria-hidden="true">
                        {profile.display_name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="directory-profile-type">
                      {PROFILE_TYPE_LABELS[profile.type]}
                    </span>
                  </div>
                  <div className="directory-card-copy">
                    <h3>{profile.display_name}</h3>
                    <p>
                      {profile.headline ||
                        profile.bio?.slice(0, 128) ||
                        `Public ${PROFILE_TYPE_LABELS[profile.type].toLowerCase()} profile`}
                    </p>
                    {profile.location && (
                      <span className="directory-location">
                        <MapPin size={14} aria-hidden="true" />
                        {profile.location}
                      </span>
                    )}
                  </div>
                  <div className="directory-card-footer">
                    <div className="directory-specialties">
                      {(profile.specialties ?? []).slice(0, 3).map((specialty) => (
                        <span key={specialty}>{specialty}</span>
                      ))}
                    </div>
                    <span className="directory-view-profile" title="View public profile">
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

