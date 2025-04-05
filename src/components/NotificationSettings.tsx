import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Switch } from './ui/switch';
import { LoadingSpinner } from './shared/LoadingSpinner';

interface NotificationSettings {
  emailNotifications: boolean;
  priceChangeAlerts: boolean;
  renewalReminders: boolean;
  newSubscriptionAlerts: boolean;
}

export const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    priceChangeAlerts: true,
    renewalReminders: true,
    newSubscriptionAlerts: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await apiService.getNotificationSettings();
        if (response.ok && response.data) {
          setSettings(response.data);
        } else {
          setError(response.error || 'Failed to fetch notification settings');
        }
      } catch (err) {
        setError('An error occurred while fetching settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleToggle = async (setting: keyof NotificationSettings) => {
    const newSettings = {
      ...settings,
      [setting]: !settings[setting]
    };

    setSaving(true);
    try {
      const response = await apiService.updateNotificationSettings(newSettings);
      if (response.ok) {
        setSettings(newSettings);
      } else {
        setError(response.error || 'Failed to update settings');
      }
    } catch (err) {
      setError('An error occurred while updating settings');
      // Revert the toggle if the update failed
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Notification Settings</h2>
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Email Notifications</h3>
            <p className="text-gray-500">Receive notifications via email</p>
          </div>
          <Switch
            checked={settings.emailNotifications}
            onCheckedChange={() => handleToggle('emailNotifications')}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Price Change Alerts</h3>
            <p className="text-gray-500">Get notified when subscription prices change</p>
          </div>
          <Switch
            checked={settings.priceChangeAlerts}
            onCheckedChange={() => handleToggle('priceChangeAlerts')}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Renewal Reminders</h3>
            <p className="text-gray-500">Receive reminders before subscriptions renew</p>
          </div>
          <Switch
            checked={settings.renewalReminders}
            onCheckedChange={() => handleToggle('renewalReminders')}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">New Subscription Alerts</h3>
            <p className="text-gray-500">Get notified when new subscriptions are detected</p>
          </div>
          <Switch
            checked={settings.newSubscriptionAlerts}
            onCheckedChange={() => handleToggle('newSubscriptionAlerts')}
            disabled={saving}
          />
        </div>
      </div>
    </Card>
  );
}; 