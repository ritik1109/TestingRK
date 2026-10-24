export const appliances = [
  { id: 'ac', name: 'AC', icon: '❄️' },
  { id: 'cooler', name: 'Cooler', icon: '💨' },
  { id: 'fridge', name: 'Fridge', icon: '🧊' },
  { id: 'chimney', name: 'Chimney', icon: '🌀' },
  { id: 'induction', name: 'Induction', icon: '🔥' },
  { id: 'washing', name: 'Washing machine', icon: '🫧' },
  { id: 'geyser', name: 'Geyser', icon: '🚿' },
  { id: 'tv', name: 'TV/LED', icon: '📺' },
  { id: 'microwave', name: 'Microwave', icon: '📡' },
  { id: 'fan', name: 'Fan', icon: '🌬️' },
  { id: 'ro', name: 'RO water purifier', icon: '💧' },
  { id: 'other', name: 'Other', icon: '🔧' },
] as const;

export const services: Record<string, string[]> = {
  ac: ['Repair', 'Installation', 'Service/Clean', 'Gas Refill'],
  cooler: ['Repair', 'Service/Clean', 'Motor Replace', 'Pad Replace'],
  fridge: ['Repair', 'Gas Refill', 'Compressor Check', 'General Service'],
  chimney: ['Repair', 'Installation', 'Service/Clean', 'Motor Replace'],
  induction: ['Repair', 'Coil Replace', 'General Service'],
  washing: ['Repair', 'Installation', 'Service/Clean', 'Motor Replace'],
  geyser: ['Repair', 'Installation', 'Element Replace', 'General Service'],
  tv: ['Repair', 'Screen Replace', 'Installation', 'General Service'],
  microwave: ['Repair', 'General Service', 'Magnetron Replace'],
  fan: ['Repair', 'Installation', 'Winding Replace'],
  ro: ['Service/Clean', 'Filter Replace', 'Repair', 'Installation'],
  other: ['Repair', 'Installation', 'General Service', 'Inspection'],
};
