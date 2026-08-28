import React from 'react';
import { BentoCard } from './ui.jsx';

export default function SettingsTab() {
  return (
    <BentoCard hover={false}>
      <h3 className="text-lg font-bold mb-2.5">Settings</h3>
      <p className="text-sm text-gray-500">Notification preferences, schedule changes and account settings are coming soon.</p>
    </BentoCard>
  );
}
