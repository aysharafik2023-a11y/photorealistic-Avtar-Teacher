import React, { useRef } from 'react';
import { User, Plus, Check } from 'lucide-react';
import { AvatarProfile } from '../types/avatar';

interface AvatarSelectorProps {
  avatars: AvatarProfile[];
  selectedAvatar: AvatarProfile;
  onSelectAvatar: (avatar: AvatarProfile) => void;
  onUploadCustomAvatar: (newAvatar: AvatarProfile) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  avatars,
  selectedAvatar,
  onSelectAvatar,
  onUploadCustomAvatar,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      const customAvatar: AvatarProfile = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, '').slice(0, 16) || 'Custom Avatar',
        role: 'Custom Portrait',
        tagline: 'User imported portrait photo',
        imageSrc: dataUrl,
        gender: 'female',
        defaultVoice: 'Kore',
        defaultEmotion: 'Joyful',
        skinHue: '#dfb79e',
        lipVermilionColor: '#be6f6f',
        landmarks: {
          mouthCenter: { x: 0.50, y: 0.52 },
          mouthLeft: { x: 0.44, y: 0.51 },
          mouthRight: { x: 0.56, y: 0.51 },
          upperLipMid: { x: 0.50, y: 0.50 },
          lowerLipMid: { x: 0.50, y: 0.54 },
          chin: { x: 0.50, y: 0.62 },
          leftEye: { x: 0.43, y: 0.35 },
          rightEye: { x: 0.57, y: 0.35 },
          leftBrow: { x: 0.43, y: 0.30 },
          rightBrow: { x: 0.57, y: 0.30 },
          noseTip: { x: 0.50, y: 0.44 },
          leftCheek: { x: 0.38, y: 0.46 },
          rightCheek: { x: 0.62, y: 0.46 },
        },
      };

      onUploadCustomAvatar(customAvatar);
      onSelectAvatar(customAvatar);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-white tracking-tight">
            Select Photo-Realistic Avatar
          </h3>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Diverse studio portraits calibrated for facial landmark deformation
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Import Photo</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCustomUpload}
          className="hidden"
        />
      </div>

      {/* Grid of Avatars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {avatars.map((av) => {
          const isSelected = selectedAvatar.id === av.id;
          return (
            <button
              key={av.id}
              onClick={() => onSelectAvatar(av)}
              className={`group relative text-left rounded-xl border overflow-hidden transition-all cursor-pointer flex flex-col ${
                isSelected
                  ? 'border-emerald-500/80 ring-1 ring-emerald-500/50 bg-neutral-900 shadow-md'
                  : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/80'
              }`}
            >
              {/* Image thumbnail */}
              <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
                <img
                  src={av.imageSrc}
                  alt={av.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top group-hover:scale-103 transition-transform duration-300"
                />
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                )}
              </div>

              {/* Text Info */}
              <div className="p-2.5 space-y-0.5 flex-1">
                <div className="text-xs font-semibold text-white truncate">
                  {av.name}
                </div>
                <div className="text-[11px] text-neutral-400 truncate">
                  {av.role}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
