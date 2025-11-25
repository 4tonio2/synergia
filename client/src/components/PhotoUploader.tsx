import React, { useRef } from 'react';
import { Plus, X } from 'lucide-react';

interface PhotoUploaderProps {
  photos: File[];
  onPhotosChange: (photos: File[]) => void;
  maxPhotos?: number;
}

export function PhotoUploader({ photos, onPhotosChange, maxPhotos = 5 }: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const remainingSlots = maxPhotos - photos.length;
    const newPhotos = files.slice(0, remainingSlots);
    
    if (newPhotos.length > 0) {
      onPhotosChange([...photos, ...newPhotos]);
    }
    
    // Reset input pour permettre de sélectionner le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(updatedPhotos);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        {photos.map((photo, index) => (
          <div key={index} className="relative group">
            <img
              src={URL.createObjectURL(photo)}
              alt={`Photo ${index + 1}`}
              className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
            />
            <button
              onClick={() => removePhoto(index)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        
        {photos.length < maxPhotos && (
          <button
            onClick={openFilePicker}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-8 h-8 text-gray-400" />
          </button>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      
      {photos.length > 0 && (
        <p className="text-xs text-gray-500">
          {photos.length} / {maxPhotos} photo{photos.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
