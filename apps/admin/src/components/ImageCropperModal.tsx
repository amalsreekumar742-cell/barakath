import { type FC, useRef } from 'react';
import { Cropper, type CropperRef } from 'react-advanced-cropper';
import 'react-advanced-cropper/dist/style.css';
import Modal from './Modal';

/**
 * ImageCropperModal — crop step of the shared image flow (skill: pick → crop → compress → upload).
 *
 * WHY wrap react-advanced-cropper in the shared Modal: every image upload crops to the right aspect
 * ratio before compression/upload, in one consistent dialog. The parent passes the picked image as a
 * data URL and receives a cropped Blob to hand to `uploadImage`.
 */
interface ImageCropperModalProps {
  isOpen: boolean;
  src: string;
  aspectRatio?: number; // e.g. 1 for square category thumbnails
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}

const ImageCropperModal: FC<ImageCropperModalProps> = ({
  isOpen,
  src,
  aspectRatio = 1,
  onCancel,
  onCropped,
}) => {
  const cropperRef = useRef<CropperRef>(null);

  const handleCrop = () => {
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) return;
    // WebP keeps the cropped asset small before the compression step.
    canvas.toBlob((blob) => blob && onCropped(blob), 'image/webp', 0.92);
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} maxWidth="max-w-2xl">
      <div className="rounded-xl border border-border bg-surface p-4 shadow-lg">
        <h2 className="mb-3 text-[16px] font-bold text-foreground">Crop image</h2>
        <div className="h-[360px] overflow-hidden rounded-lg bg-ink/5">
          <Cropper
            ref={cropperRef}
            src={src}
            className="h-full"
            stencilProps={{ aspectRatio }}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Crop
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ImageCropperModal;
