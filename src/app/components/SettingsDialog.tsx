import { X, Music2, Check, LogOut, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface SettingsDialogProps {
  currentUser: any;
  onClose: () => void;
  onSave: (settings: { musicService: 'spotify' | 'apple' }) => void;
  onLogout?: () => void;
}

export function SettingsDialog({ currentUser, onClose, onSave, onLogout }: SettingsDialogProps) {
  const [musicService, setMusicService] = useState<'spotify' | 'apple'>(
    currentUser?.musicService || 'spotify'
  );

  const handleSave = () => {
    onSave({ musicService });
    onClose();
  };

  const handleLogout = () => {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      localStorage.removeItem('shakemoi_auth_token');
      localStorage.removeItem('shakemoi_user');
      localStorage.removeItem('shakemoi_onboarding');
      
      if (onLogout) {
        onLogout();
      } else {
        window.location.reload();
      }
    }
  };
}