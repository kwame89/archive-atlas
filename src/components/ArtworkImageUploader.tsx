import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { ImagePlus, Star, Trash2, Upload, X } from "lucide-react";

interface ArtworkImageUploaderProps {
  files: File[];
  primaryIndex: number;
  onFilesChange: (files: File[]) => void;
  onPrimaryIndexChange: (index: number) => void;
  maxFiles?: number;
  showPrimaryChoice?: boolean;
  emptyTitle?: string;
  filledTitle?: string;
}

interface Preview {
  key: string;
  src: string;
}

function fileKey(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join(":");
}

export function ArtworkImageUploader({
  files,
  primaryIndex,
  onFilesChange,
  onPrimaryIndexChange,
  maxFiles = 30,
  showPrimaryChoice = true,
  emptyTitle = "Add artwork images",
  filledTitle = "Add more images",
}: ArtworkImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);

  useEffect(() => {
    const nextPreviews = files.map((file) => ({
      key: fileKey(file),
      src: URL.createObjectURL(file),
    }));
    setPreviews(nextPreviews);
    return () => nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.src));
  }, [files]);

  function appendFiles(candidates: File[]) {
    const imageFiles = candidates.filter((file) => file.type.startsWith("image/"));
    const existingKeys = new Set(files.map(fileKey));
    const uniqueFiles = imageFiles.filter((file) => !existingKeys.has(fileKey(file)));
    const availableSlots = Math.max(0, maxFiles - files.length);
    const filesToAdd = uniqueFiles.slice(0, availableSlots);

    if (filesToAdd.length > 0) {
      onFilesChange([...files, ...filesToAdd]);
      if (files.length === 0) onPrimaryIndexChange(0);
    }

    const skipped = candidates.length - filesToAdd.length;
    setNotice(
      skipped > 0
        ? `${skipped} ${skipped === 1 ? "file was" : "files were"} skipped because it was not an image, was already selected, or exceeded the ${maxFiles}-image limit.`
        : ""
    );
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    appendFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    appendFiles(Array.from(event.dataTransfer.files));
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    inputRef.current?.click();
  }

  function removeFile(index: number) {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
    onFilesChange(nextFiles);

    if (nextFiles.length === 0) {
      onPrimaryIndexChange(0);
    } else if (index < primaryIndex) {
      onPrimaryIndexChange(primaryIndex - 1);
    } else if (index === primaryIndex) {
      onPrimaryIndexChange(Math.min(index, nextFiles.length - 1));
    }
  }

  function removeAll() {
    onFilesChange([]);
    onPrimaryIndexChange(0);
    setNotice("");
  }

  return (
    <div className="artwork-image-uploader">
      <label id={`${inputId}-label`} htmlFor={inputId}>
        Images
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
      />

      <div
        className={`artwork-image-dropzone${dragActive ? " is-dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-labelledby={`${inputId}-label ${inputId}-prompt`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleDropzoneKeyDown}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={handleDrop}
      >
        <span className="artwork-image-dropzone-icon" aria-hidden="true">
          {files.length > 0 ? <ImagePlus size={24} /> : <Upload size={24} />}
        </span>
        <span className="artwork-image-dropzone-copy">
          <strong id={`${inputId}-prompt`}>
            {files.length > 0 ? filledTitle : emptyTitle}
          </strong>
          <small>Choose images or drop them here</small>
        </span>
        <span className="artwork-image-dropzone-action">
          {files.length > 0 ? "Choose more" : "Choose images"}
        </span>
      </div>

      {notice && (
        <p className="artwork-image-uploader-notice" role="status">
          {notice}
        </p>
      )}

      {files.length > 0 && (
        <>
          <div className="artwork-image-uploader-summary">
            <span>
              {files.length} {files.length === 1 ? "image" : "images"} selected
            </span>
            <button
              type="button"
              className="artwork-image-clear-button"
              onClick={removeAll}
            >
              <Trash2 size={14} aria-hidden="true" />
              Remove all
            </button>
          </div>

          <div className="artwork-image-preview-grid">
            {previews.map((preview, index) => (
              <article
                key={preview.key}
                className={`artwork-image-preview${
                  showPrimaryChoice && primaryIndex === index ? " is-primary" : ""
                }`}
              >
                <img src={preview.src} alt="" />
                <button
                  type="button"
                  className="artwork-image-remove-button"
                  aria-label={`Remove ${files[index].name}`}
                  title="Remove image"
                  onClick={() => removeFile(index)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
                <div className="artwork-image-preview-meta">
                  <span title={files[index].name}>{files[index].name}</span>
                  {showPrimaryChoice && (
                    <label>
                      <input
                        type="radio"
                        name={`${inputId}-primary`}
                        checked={primaryIndex === index}
                        onChange={() => onPrimaryIndexChange(index)}
                      />
                      <Star
                        size={13}
                        fill={primaryIndex === index ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                      Primary
                    </label>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
