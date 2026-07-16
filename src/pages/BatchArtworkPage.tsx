import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Images, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { ArtworkImageUploader } from "../components/ArtworkImageUploader";
import { createArtwork, uploadArtworkImages } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import type { Profile } from "../types/database";

const MAX_BATCH_ARTWORKS = 25;

interface BatchItem {
  file: File;
  title: string;
}

interface CreatedWithoutImage {
  artworkId: string;
  title: string;
  message: string;
}

interface BatchResult {
  createdCount: number;
  failedCount: number;
  createdWithoutImages: CreatedWithoutImage[];
}

function fileKey(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join(":");
}

function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "");
  return withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseOptionalYear(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1000 || year > 3000) {
    throw new Error("Use a four-digit year between 1000 and 3000.");
  }
  return year;
}

export function BatchArtworkPage({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [medium, setMedium] = useState("");
  const [artType, setArtType] = useState("");
  const [year, setYear] = useState("");
  const [dateCreated, setDateCreated] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, title: "" });
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState("");

  const files = items.map((item) => item.file);

  function handleFilesChange(nextFiles: File[]) {
    setItems((current) => {
      const existing = new Map(current.map((item) => [fileKey(item.file), item]));
      return nextFiles.map(
        (file) =>
          existing.get(fileKey(file)) ?? {
            file,
            title: titleFromFilename(file.name),
          }
      );
    });
    setResult(null);
  }

  function updateTitle(index: number, title: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title } : item
      )
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (items.length === 0) {
      setError("Choose at least one image to begin a batch.");
      return;
    }

    if (items.some((item) => !item.title.trim())) {
      setError("Every artwork needs a title.");
      return;
    }

    let parsedYear: number | undefined;
    try {
      parsedYear = parseOptionalYear(year);
    } catch (parseError) {
      setError(getErrorMessage(parseError));
      return;
    }

    setSubmitting(true);
    const failedItems: BatchItem[] = [];
    const failureMessages: string[] = [];
    const createdWithoutImages: CreatedWithoutImage[] = [];
    let createdCount = 0;

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      setProgress({
        current: index + 1,
        total: items.length,
        title: item.title.trim(),
      });

      try {
        const artwork = await createArtwork(
          profile.id,
          {
            title: item.title.trim(),
            medium: medium.trim() || undefined,
            artType: artType.trim() || undefined,
            year: parsedYear,
            dateCreated: dateCreated || undefined,
          },
          profile.id
        );
        createdCount += 1;

        try {
          await uploadArtworkImages(artwork.id, [item.file]);
        } catch (uploadError) {
          createdWithoutImages.push({
            artworkId: artwork.id,
            title: item.title.trim(),
            message: getErrorMessage(uploadError),
          });
        }
      } catch (createError) {
        failedItems.push(item);
        failureMessages.push(`${item.title.trim()}: ${getErrorMessage(createError)}`);
      }
    }

    setItems(failedItems);
    setResult({
      createdCount,
      failedCount: failedItems.length,
      createdWithoutImages,
    });
    setError(failureMessages.join(" "));
    setProgress({ current: 0, total: 0, title: "" });
    setSubmitting(false);
  }

  return (
    <div className="page-wide batch-artwork-page">
      <AppHeader profile={profile} />

      <main>
        <header className="batch-artwork-heading">
          <div>
            <p className="eyebrow">Batch entry</p>
            <h1>Add multiple artworks</h1>
            <p>Each image becomes its own artwork record.</p>
          </div>
          <Link to="/artworks/new" className="batch-artwork-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Add one artwork
          </Link>
        </header>

        <form className="batch-artwork-form" onSubmit={handleSubmit}>
          <section className="batch-artwork-upload-section">
            <ArtworkImageUploader
              files={files}
              primaryIndex={0}
              onFilesChange={handleFilesChange}
              onPrimaryIndexChange={() => undefined}
              maxFiles={MAX_BATCH_ARTWORKS}
              showPrimaryChoice={false}
              emptyTitle="Choose artwork images"
              filledTitle="Add more artworks"
            />
          </section>

          {items.length > 0 && (
            <>
              <section className="batch-artwork-defaults">
                <div className="batch-artwork-section-heading">
                  <div>
                    <p className="eyebrow">Shared details</p>
                    <h2>Apply to every artwork</h2>
                  </div>
                  <span>{items.length} records</span>
                </div>
                <div className="batch-artwork-default-grid">
                  <label>
                    Medium
                    <input
                      value={medium}
                      onChange={(event) => setMedium(event.target.value)}
                      placeholder="e.g. Oil on canvas"
                    />
                  </label>
                  <label>
                    Type of art
                    <input
                      value={artType}
                      onChange={(event) => setArtType(event.target.value)}
                      placeholder="Painting, sculpture, photography"
                    />
                  </label>
                  <label>
                    Display year
                    <input
                      type="number"
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                      placeholder="2026"
                    />
                  </label>
                  <label>
                    Date created
                    <input
                      type="date"
                      value={dateCreated}
                      onChange={(event) => setDateCreated(event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="batch-artwork-review">
                <div className="batch-artwork-section-heading">
                  <div>
                    <p className="eyebrow">Review</p>
                    <h2>Artwork titles</h2>
                  </div>
                </div>
                <ol className="batch-artwork-list">
                  {items.map((item, index) => (
                    <li key={fileKey(item.file)}>
                      <span className="batch-artwork-number">{index + 1}</span>
                      <span className="batch-artwork-file-icon" aria-hidden="true">
                        <Images size={17} />
                      </span>
                      <label>
                        <span className="visually-hidden">
                          Title for {item.file.name}
                        </span>
                        <input
                          required
                          value={item.title}
                          onChange={(event) => updateTitle(index, event.target.value)}
                        />
                        <small title={item.file.name}>{item.file.name}</small>
                      </label>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="batch-artwork-submit-row">
                <div aria-live="polite">
                  {submitting && (
                    <>
                      <LoaderCircle
                        className="batch-artwork-spinner"
                        size={17}
                        aria-hidden="true"
                      />
                      <span>
                        Creating {progress.current} of {progress.total}: {progress.title}
                      </span>
                    </>
                  )}
                </div>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Creating artworks..." : `Create ${items.length} artworks`}
                  {!submitting && <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </div>
            </>
          )}

          {result && (
            <section className="batch-artwork-result" aria-live="polite">
              <CheckCircle2 size={22} aria-hidden="true" />
              <div>
                <h2>
                  {result.createdCount}{" "}
                  {result.createdCount === 1 ? "artwork was" : "artworks were"} created
                </h2>
                {result.failedCount > 0 && (
                  <p>{result.failedCount} could not be created and remain in the list.</p>
                )}
                {result.createdWithoutImages.length > 0 && (
                  <div className="batch-artwork-warnings">
                    <p>
                      The following records were created, but their images need to be added again:
                    </p>
                    {result.createdWithoutImages.map((warning) => (
                      <Link key={warning.artworkId} to={`/artworks/${warning.artworkId}`}>
                        {warning.title}
                        <span className="visually-hidden">: {warning.message}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link to="/" className="button-link">
                  Return to archive
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </section>
          )}

          {error && <p className="error batch-artwork-error">{error}</p>}
        </form>
      </main>
    </div>
  );
}
