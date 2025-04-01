import React, { useState, useCallback, useRef } from 'react';
import { DndProvider, useDrag, useDrop, ConnectDragSource, ConnectDropTarget } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface DragItem {
  id: string;
  content: string;
  category: string;
}

interface DropZone {
  id: string;
  accepts: string[];
}

interface DragDropConfig {
  items: DragItem[];
  zones: DropZone[];
}

interface DragDropProps {
  config: DragDropConfig;
}

const ItemTypes = {
  DRAGGABLE: 'draggable',
};

const DraggableItem: React.FC<{ 
  item: DragItem; 
  isPlaced?: boolean;
}> = ({ item, isPlaced }) => {
  const dragRef = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DRAGGABLE,
    item: { ...item },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: !isPlaced,
  }));

  // Connect drag to ref
  drag(dragRef);

  return (
    <div
      ref={dragRef}
      className={`draggable-item ${isDragging ? 'dragging' : ''} ${isPlaced ? 'placed' : ''}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isPlaced ? 'default' : 'move',
        padding: '8px 12px',
        margin: '4px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '4px',
        boxShadow: isDragging ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none',
      }}
    >
      {item.content}
    </div>
  );
};

const DropZoneComponent: React.FC<{
  zone: DropZone;
  onDrop: (item: DragItem) => void;
  placedItems: DragItem[];
}> = ({ zone, onDrop, placedItems }) => {
  const dropRef = useRef<HTMLDivElement>(null);
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.DRAGGABLE,
    drop: (item: DragItem) => {
      if (zone.accepts.includes(item.category)) {
        onDrop(item);
      }
    },
    canDrop: (item: DragItem) => zone.accepts.includes(item.category),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  // Connect drop to ref
  drop(dropRef);

  return (
    <div
      ref={dropRef}
      className={`drop-zone ${isOver ? 'over' : ''} ${canDrop ? 'can-drop' : ''}`}
      style={{
        padding: '16px',
        backgroundColor: isOver && canDrop ? '#f0f9ff' : '#f8fafc',
        border: `2px dashed ${isOver && canDrop ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: '8px',
        minHeight: '120px',
        transition: 'all 0.2s ease',
      }}
    >
      <div className="zone-label" style={{ marginBottom: '8px', color: '#64748b' }}>
        {zone.accepts.join(' or ')} items
      </div>
      <div className="placed-items" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {placedItems.map(item => (
          <DraggableItem key={item.id} item={item} isPlaced={true} />
        ))}
      </div>
    </div>
  );
};

const DragDrop: React.FC<DragDropProps> = ({ config }) => {
  const [error, setError] = useState<string | null>(null);
  const [placedItems, setPlacedItems] = useState<{ [zoneId: string]: DragItem[] }>({});
  const [availableItems, setAvailableItems] = useState<DragItem[]>([]);

  // Validate config on mount
  React.useEffect(() => {
    try {
      if (!config) throw new Error('No configuration provided');
      if (!Array.isArray(config.items)) throw new Error('Items must be an array');
      if (!Array.isArray(config.zones)) throw new Error('Zones must be an array');
      
      // Validate items
      config.items.forEach(item => {
        if (!item.id || !item.content || !item.category) {
          throw new Error('Invalid item structure');
        }
      });

      // Validate zones
      config.zones.forEach(zone => {
        if (!zone.id || !Array.isArray(zone.accepts)) {
          throw new Error('Invalid zone structure');
        }
      });

      setAvailableItems(config.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid configuration');
    }
  }, [config]);

  const handleDrop = useCallback((zone: DropZone, item: DragItem) => {
    setPlacedItems(prev => ({
      ...prev,
      [zone.id]: [...(prev[zone.id] || []), item]
    }));
    setAvailableItems(prev => prev.filter(i => i.id !== item.id));
  }, []);

  if (error) {
    return (
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#fee2e2', 
        border: '1px solid #ef4444',
        borderRadius: '4px',
        color: '#dc2626' 
      }}>
        Error: {error}
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          <h4 style={{ marginBottom: '12px', color: '#1f2937' }}>Available Items</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {availableItems.map(item => (
              <DraggableItem key={item.id} item={item} />
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {config.zones.map(zone => (
            <div key={zone.id}>
              <DropZoneComponent
                zone={zone}
                onDrop={(item) => handleDrop(zone, item)}
                placedItems={placedItems[zone.id] || []}
              />
            </div>
          ))}
        </div>
      </div>
    </DndProvider>
  );
};

export default DragDrop; 