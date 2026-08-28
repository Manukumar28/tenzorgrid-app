import React from 'react';
import { BentoCard } from './ui.jsx';

export default function SettingsTab() {
  return (
    <BentoCard hover={false}>
      <h3 className="text-sm font-bold mb-2">Settings</h3>
      <p className="text-sm text-gray-400">Notification preferences, schedule changes and account settings are coming soon.</p>
    </BentoCard>
  );
}
