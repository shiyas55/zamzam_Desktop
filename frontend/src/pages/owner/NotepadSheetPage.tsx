import React, { useState } from 'react';
import { NotepadSheetModal } from '../../components/NotepadSheetModal';

export const NotepadSheetPage: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{ height: 'calc(100vh - 120px)', width: '100%' }}>
      <NotepadSheetModal isOpen={isOpen} onClose={() => window.history.back()} />
    </div>
  );
};
