import { useState } from 'react';

interface Location {
  id: string;
  name: string;
  description: string;
  players: string[];
  evidence: Evidence[];
}

interface Evidence {
  id: string;
  name: string;
  description: string;
  found: boolean;
}

interface GameMapProps {
  locations: Location[];
  currentPlayer: string;
  onMove: (locationId: string) => void;
  onExamine: (evidenceId: string) => void;
}

export default function GameMap({ locations, currentPlayer, onMove, onExamine }: GameMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  return (
    <div className="p-4 border rounded bg-white">
      <h3 className="text-lg font-semibold mb-4">地圖</h3>
      <div className="grid grid-cols-2 gap-4">
        {locations.map((location) => (
          <div
            key={location.id}
            className={`p-4 border rounded cursor-pointer ${
              location.players.includes(currentPlayer) ? 'bg-blue-50' : 'bg-gray-50'
            }`}
            onClick={() => {
              setSelectedLocation(location.id);
              onMove(location.id);
            }}
          >
            <h4 className="font-medium">{location.name}</h4>
            <p className="text-sm text-gray-600">{location.description}</p>
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                在場玩家：{location.players.join(', ')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 證物列表 */}
      {selectedLocation && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h4 className="font-medium mb-2">證物</h4>
          <div className="grid grid-cols-2 gap-2">
            {locations
              .find((l) => l.id === selectedLocation)
              ?.evidence.map((evidence) => (
                <button
                  key={evidence.id}
                  onClick={() => onExamine(evidence.id)}
                  disabled={evidence.found}
                  className={`p-2 text-sm border rounded ${
                    evidence.found
                      ? 'bg-gray-200 cursor-not-allowed'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {evidence.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
