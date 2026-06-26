import React from 'react';

export const RoomCard: React.FC<{ name: string; type?: string; onPress?: () => void }> = ({ name, type, onPress }) => {
  return (
    <div className="border rounded p-3" onClick={onPress} role="button" tabIndex={0}>
      <div className="font-medium">{name}</div>
      {type && <div className="text-sm text-gray-600">{type}</div>}
    </div>
  );
};
