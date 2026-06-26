import React from 'react';

export const RoomCard: React.FC<{ name: string; roomType?: string; onPress?: () => void }> = ({ name, roomType, onPress }) => {
  return (
    <div className="border rounded p-3" onClick={onPress} role="button" tabIndex={0}>
      <div className="font-medium">{name}</div>
      {roomType && <div className="text-sm text-gray-600">{roomType}</div>}
    </div>
  );
};
